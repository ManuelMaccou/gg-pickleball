import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { logError } from '@/lib/sentry/logger';
import { jobService } from '@/lib/services/matchBulkUpload/jobService';
import { transformAndEnrichDuprMatches } from '@/lib/services/matchBulkUpload/duprTransformationService';

import { createMatch } from '@/lib/services/matchBulkUpload/matchService';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { DuprMatch, DuprMember } from '@/app/types/duprTypes';
import { findOrCreateUserForUpload } from '@/lib/services/matchBulkUpload/userService';
import { JobResult, RowContextData } from '@/app/types/bulkUploadTypes';
import Match from '@/app/models/Match';
import DataSource from '@/app/models/DataSource';
import { startSession } from 'mongoose';
import SkippedDuprEntry from '@/app/models/SkippedDuprEntry';

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (authorizedUser?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { duprMatches, locationId, duprId, isGlobalContext, dataSourceType } = await req.json() as { 
      duprMatches: DuprMatch[], 
      locationId: string, 
      duprId: number, 
      isGlobalContext?: boolean,
      dataSourceType: string,
    };

    if (!duprMatches || duprMatches.length === 0) {
      return NextResponse.json({ error: 'A list of DUPR matches is required.' }, { status: 400 });
    }
    if (!isGlobalContext && !locationId) {
      return NextResponse.json({ error: 'A location is required for a local sync.' }, { status: 400 });
    }
    if (isGlobalContext && authorizedUser.superAdmin === false) {
        return NextResponse.json({ error: 'Only superAdmins can perform a global sync.' }, { status: 403 });
    }
    if (!dataSourceType) {
      return NextResponse.json({ error: 'A dataSourceType is required.' }, { status: 400 });
    }

    const DUPR_TOKEN = process.env.DUPR_API_BACKEND_BEARER_TOKEN;
    if (!DUPR_TOKEN) throw new Error("DUPR API token is not configured.");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL is not configured.");

    if (!duprId) {
        throw new Error("Could not determine a DUPR Club ID for fetching members.");
    }

    const dataSource = await DataSource.findOne({ type: dataSourceType });
    if (!dataSource) {
      return NextResponse.json({ error: `Data source with type '${dataSourceType}' not found.` }, { status: 404 });
    }
    const dataSourceId = dataSource._id.toString();
    console.log('dataSourceId:', dataSourceId)
    
    const membersRes = await fetch(`${baseUrl}/api/dupr/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '', // Forward the auth cookie
      },
      body: JSON.stringify({ clubId: duprId }),
    });

    if (!membersRes.ok) {
      const errorBody = await membersRes.text();
      throw new Error(`Failed to fetch DUPR member list. Status: ${membersRes.status}. Body: ${errorBody}`);
    }

    const membersData = await membersRes.json();
    const duprMembers: DuprMember[] = membersData.members || [];

    const { validMatches, skippedRecords } = transformAndEnrichDuprMatches(duprMatches, duprMembers);

    if (skippedRecords.length > 0) {
      // We can associate these with the job ID if created, or just save them now
      await SkippedDuprEntry.insertMany(skippedRecords.map(r => ({ ...r, createdAt: new Date() })));
    }

    const totalGamesToProcess = validMatches.length;
    const initialResults: JobResult[] = [];
    const jobId = await jobService.createWithInitialResults(initialResults);

    (async () => {
      try {
        for (let i = 0; i < validMatches.length; i++) {
          const matchData = validMatches[i];
          const rowNumber = i + 1;
          const rowContextData: RowContextData = {
            players: matchData.players.map(p => p.name),
            score: `${matchData.team1_score} - ${matchData.team2_score}`,
          };

          const session = await startSession();
          
          try {
            session.startTransaction();

            // 1. Find or create all 4 users in parallel
            const userResults = [];
            for (const player of matchData.players) {
              const result = await findOrCreateUserForUpload(player.name, player.email, player.duprId, { session });
              userResults.push(result);
            }

            // 2. Map original names to the final user IDs
            const userMap = new Map(userResults.map(res => [res.originalName, res.user._id]));
            const matchDate = matchData.matchDate;
            const isHistorical = true;
            const eventName = matchData.eventName

            const getIds = (names: string[]) => names.map(n => userMap.get(n)!);
            const team1Ids = getIds([matchData.players[0].name, matchData.players[1].name]);
            const team2Ids = getIds([matchData.players[2].name, matchData.players[3].name]);
            const winnerIds = getIds(matchData.winners.map(w => w.name));
            
            const allPlayerIds = [...team1Ids, ...team2Ids];

            let matchDoc = await Match.findOne({ 
              duprMatchId: matchData.duprMatchId, 
              duprGameNumber: matchData.gameNumber 
            }).session(session);

            let usersToProcess: string[] = [];
            let currentMatchId: string;

            if (matchDoc) {
                // Scenario: Match exists.
                // We calculate which users have NOT been processed yet.
                const processedSet = new Set(matchDoc.processedUsers?.map((id: any) => id.toString()) || []);
                
                usersToProcess = allPlayerIds.filter(id => !processedSet.has(id));

                if (usersToProcess.length === 0) {
                  // Everyone has already been processed. Skip entirely.
                  await session.abortTransaction();
                  await jobService.addResult(jobId, { 
                      row: rowNumber, status: 'skipped', message: 'Match already fully processed.', data: rowContextData 
                  });
                  continue; 
                }
                
                // We have some new users to update. Add them to the list.
                matchDoc.processedUsers.push(...usersToProcess);
                await matchDoc.save({ session });

                currentMatchId = matchDoc.matchId;

            } else {
                // Scenario: New Match.
                // Create it and mark ALL players as processed.
                usersToProcess = allPlayerIds;

              // 3. Create the Match document
              const newMatchDoc = await createMatch({
                duprMatchId: matchData.duprMatchId,
                duprGameNumber: matchData.gameNumber,
                eventName: eventName,
                matchDate: matchDate,
                location: isGlobalContext ? null : locationId,
                team1Ids, team1Score: matchData.team1_score,
                team2Ids, team2Score: matchData.team2_score,
                winners: winnerIds,
                dataSourceId: dataSourceId,
                processedUsers: allPlayerIds,
                isGlobalContext
              }, { session });

              currentMatchId = newMatchDoc.matchId;
            }

            // 4. Process achievements
            await updateUserAndAchievements({
              team1Ids: team1Ids,
              team2Ids: team2Ids,
              winners: winnerIds,
              location: isGlobalContext ? 'global' : locationId.toString(),
              matchId: currentMatchId,
              team1Score: matchData.team1_score,
              team2Score: matchData.team2_score,
              matchDate: matchDate,
              isHistorical,
              isGlobalContext: !!isGlobalContext,
              triggeringEvent: eventName,
              dataSourceId: dataSourceId,
              targetUserIds: usersToProcess
           }, { session });

            await session.commitTransaction();
                        
            // 5. Report success for this row
            await jobService.addResult(jobId, { 
              row: rowNumber, 
              status: 'success', 
              message: 'Match processed successfully.', 
              data: rowContextData 
            });
          

          } catch (error: unknown) {
            await session.abortTransaction();
            const status: JobResult['status'] = 'server_error';
            const userMessage = "A server error occurred. We have been notified.";
            
            // Log the actual technical error for developers.
            logError(error, { 
              message: `Error processing DUPR match (Row ${rowNumber})`,
              locationId: locationId,
              matchData,
            });
          
            await jobService.addResult(jobId, { 
              row: rowNumber, 
              status, 
              message: userMessage, 
              data: rowContextData 
            });
          } finally {
            await session.endSession();
          }
        }
        await jobService.complete(jobId, 'complete');

      } catch (error: unknown) {
        console.error("Catastrophic error during DUPR bulk upload job:", error);
        logError(error, { 
            message: 'A critical error occurred during the DUPR bulk upload job.',
            jobId: jobId,
            locationId: locationId,
        });

        // Add a general error message for the user to see.
       await jobService.addResult(jobId, { 
          row: 0,
          status: 'server_error', 
          message: 'A critical error occurred before processing could complete. The job has been stopped.', 
          data: {
            players: [],
            score: 'N/A'
          }
        });

        await jobService.complete(jobId, 'failed');
      }
    })();
    
    return NextResponse.json({ 
      jobId,
      totalRows: totalGamesToProcess 
    });

  } catch (error) {
    logError(error, { message: 'Failed to start DUPR upload job.' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}