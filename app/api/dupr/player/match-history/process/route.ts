import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Match from '@/app/models/Match';
import DataSource from '@/app/models/DataSource';
import { startSession } from 'mongoose';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { createMatch } from '@/lib/services/matchBulkUpload/matchService';
import { transformPersonalDuprMatches } from '@/lib/services/matchBulkUpload/duprTransformationService';
import { authenticatedDuprFetch } from '@/lib/services/duprAuth';

async function fetchDuprMatchDetails(matchId: number) {
    const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
    
    const response = await authenticatedDuprFetch(`https://${DUPR_API_BASE_URL}/api/match/v1.0/${matchId}`, {
        method: 'GET'
    });

    console.log('response:', response)
  
    if (!response.ok) {
        console.error(`Failed to fetch details for match ${matchId}: ${response.statusText}`);
        return null; 
    }

    const data = await response.json();
    console.log('data:', data)
    
    if (data && data.result) {
        return data.result;
    }
    return null;
}

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse Body for Match IDs
  const body = await req.json();
  const matchIdsToProcess: number[] = body.matchIds || [];

  if (matchIdsToProcess.length === 0) {
    return NextResponse.json({ error: "No matches selected" }, { status: 400 });
  }

  // Set up SSE Stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await connectToDatabase();
        
        // Config Setup
        const userDoc = await User.findById(authorizedUser.id);
        const duprId = userDoc?.dupr?.id;
        
        // Note: Removed DUPR_TOKEN check. Auth service handles it.
        
        const dataSource = await DataSource.findOne({ type: 'dupr' });
        
        if (!duprId || !dataSource) {
            sendEvent({ type: 'ERROR', message: "Configuration Error: Missing DUPR ID or Data Source" });
            controller.close();
            return;
        }

        const dataSourceId = dataSource._id.toString();

        // --- Processing Loop ---
        let processedCount = 0;
        const total = matchIdsToProcess.length;

        for (let i = 0; i < total; i++) {
            const matchId = matchIdsToProcess[i];
            
            sendEvent({ type: 'PROGRESS', current: i + 1, total, status: `Fetching details for match ${matchId}...` });

            // Updated call: No token passed
            const matchDetails = await fetchDuprMatchDetails(matchId);
            
            if (!matchDetails) {
                sendEvent({ type: 'LOG', message: `Failed to fetch details for match ${matchId}. Skipping.` });
                continue;
            }

            const gamesToProcess = transformPersonalDuprMatches([matchDetails]);

            if (gamesToProcess.length === 0) {
                 sendEvent({ type: 'LOG', message: `No valid games found in match ${matchId}.` });
                 continue;
            }

            // 4. Save to DB (Transaction)
            const session = await startSession();
            try {
                for (const game of gamesToProcess) {
                    session.startTransaction();

                    // Check Duplicate Match
                    let matchDoc = await Match.findOne({ 
                        duprMatchId: game.duprMatchId.toString(), 
                        duprGameNumber: game.gameNumber 
                    }).session(session);

                    let shouldProcessUser = false;
                    let currentMatchId: string;

                    // Resolve Player IDs
                    const resolveId = (pid: string | number) => String(pid) === String(duprId) ? authorizedUser.id : null; 
                    
                    const t1Ids = [
                        resolveId(game.team1.player1.duprId), 
                        resolveId(game.team1.player2.duprId)
                    ];
                    const t2Ids = [
                        resolveId(game.team2.player1.duprId), 
                        resolveId(game.team2.player2.duprId)
                    ];
                    
                    const userIsInMatch = [...t1Ids, ...t2Ids].includes(authorizedUser.id);

                    // Determine Winner
                    const score1 = game.team1.score;
                    const score2 = game.team2.score;
                    const team1Won = score1 > score2;
                    const winnerIds = team1Won ? t1Ids : t2Ids;

                    if (matchDoc) {
                        // *** EXISTING MATCH LOGIC ***
                        const processedSet = new Set(matchDoc.processedUsers?.map((id: any) => id.toString()) || []);
                        
                        if (userIsInMatch && !processedSet.has(authorizedUser.id)) {
                            shouldProcessUser = true;
                            
                            // 1. Add to processedUsers
                            matchDoc.processedUsers.push(authorizedUser.id);
                            
                            // 2. Update Team Arrays (Join the match)
                            if (t1Ids.includes(authorizedUser.id)) {
                                const currentT1 = matchDoc.team1.players.map((id: any) => id.toString());
                                if (!currentT1.includes(authorizedUser.id)) {
                                    matchDoc.team1.players.push(authorizedUser.id);
                                }
                            }

                            if (t2Ids.includes(authorizedUser.id)) {
                                const currentT2 = matchDoc.team2.players.map((id: any) => id.toString());
                                if (!currentT2.includes(authorizedUser.id)) {
                                    matchDoc.team2.players.push(authorizedUser.id);
                                }
                            }

                            // 3. Update Winners Array
                            if (winnerIds.includes(authorizedUser.id)) {
                                const currentWinners = matchDoc.winners.map((id: any) => id.toString());
                                if (!currentWinners.includes(authorizedUser.id)) {
                                    matchDoc.winners.push(authorizedUser.id);
                                }
                            }

                            await matchDoc.save({ session });
                        }
                        currentMatchId = matchDoc.matchId;
                    } else {
                        // *** NEW MATCH LOGIC ***
                        shouldProcessUser = userIsInMatch;
                        
                        const t1Names = [game.team1.player1.name, game.team1.player2.name];
                        const t2Names = [game.team2.player1.name, game.team2.player2.name];

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

                    // Update Stats
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
                console.error(`Error saving match ${matchId}`, err);
                sendEvent({ type: 'LOG', message: `Error saving match ${matchId}: ${err.message}` });
            } finally {
                session.endSession();
            }
        }

        sendEvent({ type: 'COMPLETE', processed: processedCount });
        controller.close();

      } catch (error: any) {
        console.error('SSE Error:', error);
        sendEvent({ type: 'ERROR', message: error.message });
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}