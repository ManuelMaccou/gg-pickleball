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

// Helper to fetch a page of matches
async function fetchDuprMatches(duprId: string, offset: number, token: string) {
  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL
    const response = await fetch(`https://${DUPR_API_BASE_URL}/api/match/history/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'accept': 'application/json'
        },
        body: JSON.stringify({
            offset,
            limit: 20, // Max allowed
            eventFormat: ["DOUBLES"],
            duprId
        })
    });

    if (!response.ok) {
      // 1. Read the error body
      const errorText = await response.text();
      console.error(`DUPR API Failed: ${response.status} ${response.statusText}`);
      console.error(`Response Body: ${errorText}`);
      
      // 2. Throw a more descriptive error
      throw new Error(`DUPR API Error (${response.status}): ${errorText}`);
  }
  console.log('response ok')
  
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

    // 2. Fetch Matches (Loop for 6 months)
    let allMatches: DuprMatch[] = [];
    let offset = 0;
    let keepFetching = true;
    const cutoffDate = DateTime.now().minus({ months: 6 }).toJSDate();

    console.log(`Starting Personal Sync for ${userDoc.name} (${duprId})...`);

    while (keepFetching) {
        console.log('fetching matches')
        const data = await fetchDuprMatches(duprId, offset, DUPR_TOKEN);
        const pageMatches: DuprMatch[] = data.result?.hits || [];
        
        if (pageMatches.length === 0) break;

        // Filter by date
        for (const match of pageMatches) {
            const matchDate = new Date(match.eventDate);
            if (matchDate < cutoffDate) {
                keepFetching = false; // Stop if we hit old matches
                break; 
            }
            allMatches.push(match);
        }

        if (keepFetching && pageMatches.length === 20) {
            offset += 20;
        } else {
            keepFetching = false;
        }
    }

    console.log(`Found ${allMatches.length} recent matches.`);

    const gamesToProcess = transformPersonalDuprMatches(allMatches);
    console.log(`Extracted ${gamesToProcess.length} valid games from match history.`);

    // 3. Processing Loop
    // 3. Processing Loop
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
            
            // --- 1. RESOLVE PLAYERS ---
            // Helper to get ID or Null (for Ghost Players)
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
            
            // --- 2. CRITICAL SAFETY CHECK ---
            // Is the logged-in user actually one of the players in this match?
            // (If testing with someone else's DUPR ID, this will be false)
            const userIsInMatch = [...t1Ids, ...t2Ids].includes(authorizedUser.id);
            
            if (!userIsInMatch) {
                console.warn(`Logged-in user (${authorizedUser.id}) not found in DUPR match ${game.duprMatchId}. Skipping stat update.`);
            }

            // --- 3. DETERMINE WINNERS ---
            const t1Names = [game.team1.player1.name, game.team1.player2.name];
            const t2Names = [game.team2.player1.name, game.team2.player2.name];

            const score1 = game.team1.score; 
            const score2 = game.team2.score;

            const team1Won = score1 > score2;
            const winnerIds = team1Won ? t1Ids : t2Ids;

            // --- 4. DB LOGIC ---
            if (matchDoc) {
                // Scenario: Match Exists
                const processedSet = new Set(matchDoc.processedUsers?.map((id: any) => id.toString()) || []);
                
                // Only process if:
                // A) The user is actually in the match
                // B) The user hasn't been processed yet
                if (userIsInMatch && !processedSet.has(authorizedUser.id)) {
                    shouldProcessUser = true;
                    matchDoc.processedUsers.push(authorizedUser.id);
                    await matchDoc.save({ session });
                }
                currentMatchId = matchDoc.matchId;
            } else {
                // Scenario: New Match
                // If the user IS in the match, we want to process stats.
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
                    // Only mark as processed if they are actually in it
                    processedUsers: userIsInMatch ? [authorizedUser.id] : [],
                    isGlobalContext: true,
                }, { session });

                currentMatchId = newMatchDoc.matchId;
            }

            // --- 5. UPDATE STATS ---
            if (shouldProcessUser) {
                // Safely map nulls to "UNKNOWN" so updateUserAndAchievements doesn't crash on ObjectId conversion
                // (Note: updateUserAndAchievements must use the isValidObjectId filter we discussed earlier)
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
                    targetUserIds: [authorizedUser.id] // Strictly target this user
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
    logError(error, { message: 'Failed to sync player matches' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}