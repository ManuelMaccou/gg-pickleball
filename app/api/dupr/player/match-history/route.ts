import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { logError } from '@/lib/sentry/logger';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Match from '@/app/models/Match';
import DataSource from '@/app/models/DataSource';
import { startSession } from 'mongoose';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { createMatch } from '@/lib/services/matchBulkUpload/matchService';
import { DuprMatch } from '@/app/types/duprTypes';
import { DateTime } from 'luxon';
import { transformPersonalDuprMatches } from '@/lib/services/matchBulkUpload/duprTransformationService';

// Updated helper to accept date range
async function fetchDuprMatches(
  duprId: string, 
  offset: number, 
  token: string,
  startDateSeconds: number,
  endDateSeconds: number
) {
  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
  
  const response = await fetch(`https://${DUPR_API_BASE_URL}/api/match/history/search`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
      },
      body: JSON.stringify({
          offset,
          limit: 10,
          eventFormat: ["DOUBLES"],
          duprId,
          // FIX: Use the variables passed in (Seconds), not hardcoded values
          startDate: startDateSeconds, 
          endDate: endDateSeconds      
      })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`DUPR API Failed: ${response.status} ${response.statusText}`);
    console.error(`Response Body: ${errorText}`);
    throw new Error(`DUPR API Error (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectToDatabase();
    
    // 1. Get User/Config
    const userDoc = await User.findById(authorizedUser.id);
    if (!userDoc?.dupr?.id) return NextResponse.json({ error: 'DUPR ID not linked.' }, { status: 400 });

    const duprId = userDoc.dupr.id;
    const DUPR_TOKEN = process.env.DUPR_API_BEARER_TOKEN;
    if (!DUPR_TOKEN) throw new Error("DUPR API token is not configured.");

    const dataSource = await DataSource.findOne({ type: 'dupr' });
    if (!dataSource) throw new Error("DUPR Data Source not found");
    const dataSourceId = dataSource._id.toString();

    // 2. Setup Date Range
    const now = DateTime.now();
    const startWindow = now.minus({ months: 6 });
    
    // FIX: Convert to Seconds (10 digits) using Math.floor
    const endDateSeconds = Math.floor(now.toSeconds());
    const startDateSeconds = Math.floor(startWindow.toSeconds());
    
    const cutoffDate = startWindow.toJSDate();

    console.log(`Starting Personal Sync for ${userDoc.name} (${duprId}). Window (Seconds): ${startDateSeconds} to ${endDateSeconds}`);

    // 3. Fetch Matches
    let allMatches: DuprMatch[] = [];
    let offset = 0;
    let keepFetching = true;

    while (keepFetching) {
        console.log(`Fetching matches offset: ${offset}`);
        
        const data = await fetchDuprMatches(duprId, offset, DUPR_TOKEN, startDateSeconds, endDateSeconds);
        
        // FIX: Use data.results (based on your Swagger output)
        const pageMatches: DuprMatch[] = data.results || [];
        
        if (pageMatches.length === 0) {
            console.log("No matches found in this page.");
            break;
        }

        for (const match of pageMatches) {
            // FIX: Handle parsing the matchDate from the API response
            // The Swagger says 'matchDate' is a number (Seconds), not a string
            let matchDateVal: Date;
            if (typeof match.eventDate === 'number') {
                matchDateVal = new Date(match.eventDate * 1000);
            } else if (match.eventDate) {
                matchDateVal = new Date(match.eventDate);
            } else {
                matchDateVal = new Date(); // Fallback safety
            }

            if (matchDateVal < cutoffDate) {
                keepFetching = false; 
                break; 
            }
            allMatches.push(match);
        }

        if (keepFetching && pageMatches.length === 10) {
            offset += 10;
        } else {
            keepFetching = false;
        }
    }

    console.log(`Found ${allMatches.length} recent matches.`);

    // Note: Ensure your transformation service can handle the data structure returned by data.results
    const gamesToProcess = transformPersonalDuprMatches(allMatches);
    console.log(`Extracted ${gamesToProcess.length} valid games from match history.`);

    // 4. Processing Loop
    let processedCount = 0;
    const session = await startSession();
    
    try {
        for (const game of gamesToProcess) {
            session.startTransaction();

            let matchDoc = await Match.findOne({ 
              duprMatchId: game.duprMatchId.toString(), 
              duprGameNumber: game.gameNumber 
            }).session(session);

            let shouldProcessUser = false;
            let currentMatchId: string;
            
            // --- RESOLVE PLAYERS ---
            const resolveId = (pid: string | number) => 
                String(pid) === String(duprId) ? authorizedUser.id : null; 

            const t1Ids = [
                resolveId(game.team1.player1.duprId), 
                resolveId(game.team1.player2.duprId)
            ];
            const t2Ids = [
                resolveId(game.team2.player1.duprId), 
                resolveId(game.team2.player2.duprId)
            ];
            
            const userIsInMatch = [...t1Ids, ...t2Ids].includes(authorizedUser.id);
            
            if (!userIsInMatch) {
                console.warn(`Logged-in user (${authorizedUser.id}) not found in DUPR match ${game.duprMatchId}.`);
            }

            const t1Names = [game.team1.player1.name, game.team1.player2.name];
            const t2Names = [game.team2.player1.name, game.team2.player2.name];

            const score1 = game.team1.score; 
            const score2 = game.team2.score;

            const team1Won = score1 > score2;
            const winnerIds = team1Won ? t1Ids : t2Ids;

            // --- DB LOGIC ---
            if (matchDoc) {
                const processedSet = new Set(matchDoc.processedUsers?.map((id: any) => id.toString()) || []);
                
                if (userIsInMatch && !processedSet.has(authorizedUser.id)) {
                    shouldProcessUser = true;
                    matchDoc.processedUsers.push(authorizedUser.id);
                    await matchDoc.save({ session });
                }
                currentMatchId = matchDoc.matchId;
            } else {
                shouldProcessUser = userIsInMatch;

                const newMatchDoc = await createMatch({
                    duprMatchId: game.duprMatchId,
                    duprGameNumber: game.gameNumber,
                    eventName: game.eventName,
                    matchDate: new Date(game.matchDate),
                    location: null,
                    team1Ids: t1Ids as string[], 
                    team1Names: t1Names, 
                    team1Score: score1,
                    team2Ids: t2Ids as string[],
                    team2Names: t2Names, 
                    team2Score: score2,
                    winners: winnerIds as string[],
                    dataSourceId: dataSourceId,
                    processedUsers: userIsInMatch ? [authorizedUser.id] : [],
                    isGlobalContext: true,
                }, { session });

                currentMatchId = newMatchDoc.matchId;
            }

            // --- UPDATE STATS ---
            if (shouldProcessUser) {
                const validT1 = t1Ids.map(id => id || "UNKNOWN");
                const validT2 = t2Ids.map(id => id || "UNKNOWN");
                const validWinners = winnerIds.map(id => id || "UNKNOWN");

                await updateUserAndAchievements({
                    team1Ids: validT1, 
                    team2Ids: validT2,
                    winners: validWinners,
                    location: 'global',
                    matchId: currentMatchId,
                    team1Score: score1,
                    team2Score: score2,
                    matchDate: new Date(game.matchDate),
                    isHistorical: true,
                    isGlobalContext: true,
                    triggeringEvent: game.eventName,
                    dataSourceId: dataSourceId,
                    targetUserIds: [authorizedUser.id]
                }, { session });

                processedCount++;
            }

            await session.commitTransaction();
        }
    } catch (err: any) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    return NextResponse.json({ success: true, count: processedCount });

  } catch (error: any) {
    const errorId = logError(error, { 
        message: 'Failed to sync player matches',
        endpoint: 'POST /api/dupr/player/match-history'
    });
    return NextResponse.json({ errorId, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}