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
import DuprImportError from '@/app/models/DuprImportError'; // <--- UPDATED IMPORT
import { sendNotificationEmail } from '@/lib/mailgun/sendNotificationEmail';

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

    if (!duprMatches || duprMatches.length === 0) return NextResponse.json({ error: 'A list of DUPR matches is required.' }, { status: 400 });
    if (!isGlobalContext && !locationId) return NextResponse.json({ error: 'A location is required for a local sync.' }, { status: 400 });
    if (isGlobalContext && authorizedUser.superAdmin === false) return NextResponse.json({ error: 'Only superAdmins can perform a global sync.' }, { status: 403 });
    if (!dataSourceType) return NextResponse.json({ error: 'A dataSourceType is required.' }, { status: 400 });

    const DUPR_TOKEN = process.env.DUPR_API_BACKEND_BEARER_TOKEN;
    if (!DUPR_TOKEN) throw new Error("DUPR API token is not configured.");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL is not configured.");

    if (!duprId) throw new Error("Could not determine a DUPR Club ID for fetching members.");

    const dataSource = await DataSource.findOne({ type: dataSourceType });
    if (!dataSource) return NextResponse.json({ error: `Data source with type '${dataSourceType}' not found.` }, { status: 404 });
    const dataSourceId = dataSource._id.toString();
    
    // --- FETCH MEMBERS ---
    const membersRes = await fetch(`${baseUrl}/api/dupr/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
      body: JSON.stringify({ clubId: duprId }),
    });

    if (!membersRes.ok) throw new Error(`Failed to fetch DUPR member list.`);
    const membersData = await membersRes.json();
    const duprMembers: DuprMember[] = membersData.members || [];

    const { validMatches, skippedRecords } = transformAndEnrichDuprMatches(duprMatches, duprMembers);

    const totalGamesToProcess = validMatches.length;
    const initialResults: JobResult[] = [];
    const jobId = await jobService.createWithInitialResults(initialResults);

    // --- LOG VALIDATION ERRORS ---
    if (skippedRecords.length > 0) {
      await DuprImportError.insertMany(skippedRecords.map(r => ({ 
          importJobId: jobId, // Link to this job
          duprMatchId: r.duprMatchId.toString(),
          playerName: r.playerName,
          duprId: r.duprId,
          errorType: 'validation',
          reason: r.reason,
          createdAt: new Date()
      })));
    }

    (async () => {
      try {
        // --- 1. GLOBAL BATCH CONTEXT ---
        const batchEmailContext = new Map<string, { 
            name: string; 
            passwordResetLink?: string; 
            earnedItems: Set<string>; 
        }>();

        for (let i = 0; i < validMatches.length; i++) {
          const matchData = validMatches[i];
          const rowNumber = i + 1;
          const rowContextData: RowContextData = {
            players: matchData.players.map(p => p.name),
            score: `${matchData.team1_score} - ${matchData.team2_score}`,
          };

          const session = await startSession();
          
          // --- 2. TRANSACTION STAGING CONTEXT ---
          const transactionEmailContext = new Map<string, { 
            name: string; 
            passwordResetLink?: string; 
            earnedItems: string[]; 
          }>();

          const userIdToEmailMap = new Map<string, string>();
          
          try {
            session.startTransaction();

            const userResults = [];
            for (const player of matchData.players) {
              const result = await findOrCreateUserForUpload(player.name, player.email, player.duprId, { session });

              // STAGE: Save to transaction context
              transactionEmailContext.set(player.email, {
                name: player.name,
                passwordResetLink: result.passwordResetLink,
                earnedItems: []
              });

              userIdToEmailMap.set(result.user._id, player.email);
              userResults.push(result);
            }

            const userMap = new Map(userResults.map(res => [res.originalName, res.user._id]));
            const matchDate = matchData.matchDate;
            const isHistorical = true;
            const eventName = matchData.eventName

            const getIds = (names: string[]) => names.map(n => userMap.get(n)!);
            const team1Ids = getIds([matchData.players[0].name, matchData.players[1].name]);
            const team2Ids = getIds([matchData.players[2].name, matchData.players[3].name]);
            const winnerIds = getIds(matchData.winners.map(w => w.name));
            const allPlayerIds = [...team1Ids, ...team2Ids];

            // --- MATCH DB LOGIC ---
            let matchDoc = await Match.findOne({ 
              duprMatchId: matchData.duprMatchId, 
              duprGameNumber: matchData.gameNumber 
            }).session(session);

            let usersToProcess: string[] = [];
            let currentMatchId: string;

            if (matchDoc) {
                const processedSet = new Set(matchDoc.processedUsers?.map((id: any) => id.toString()) || []);
                usersToProcess = allPlayerIds.filter(id => !processedSet.has(id));

                if (usersToProcess.length === 0) {
                  await session.abortTransaction();
                  await jobService.addResult(jobId, { 
                      row: rowNumber, status: 'skipped', message: 'Match already fully processed.', data: rowContextData 
                  });
                  continue; 
                }
                matchDoc.processedUsers.push(...usersToProcess);
                await matchDoc.save({ session });
                currentMatchId = matchDoc.matchId;
            } else {
                usersToProcess = allPlayerIds;
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

            // --- ACHIEVEMENTS LOGIC ---
            const achievementResult = await updateUserAndAchievements({
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

           // STAGE: Add rewards to transaction context
           if (achievementResult.success && achievementResult.earnedAchievements) {
              for (const earner of achievementResult.earnedAchievements) {
                const email = userIdToEmailMap.get(earner.userId); 
                if (email) {
                  const context = transactionEmailContext.get(email);
                  if (context) {
                    if ('items' in earner) {
                       const items = (earner as any).items as string[];
                       context.earnedItems.push(...items);
                    }
                  }
                }
              }
           }

            await session.commitTransaction();

            // --- 3. COMMIT SUCCESS: MERGE INTO GLOBAL BATCH ---
            transactionEmailContext.forEach((localData, email) => {
                const globalData = batchEmailContext.get(email) || {
                    name: localData.name,
                    earnedItems: new Set<string>()
                };

                if (localData.passwordResetLink) {
                    globalData.passwordResetLink = localData.passwordResetLink;
                }
                localData.earnedItems.forEach(item => globalData.earnedItems.add(item));
                batchEmailContext.set(email, globalData);
            });
                          
            await jobService.addResult(jobId, { 
              row: rowNumber, status: 'success', message: 'Match processed successfully.', data: rowContextData 
            });

          } catch (error: unknown) {
            await session.abortTransaction();
            
            const errorMessage = error instanceof Error ? error.message : "Unknown Server Error";

            // --- LOG PROCESSING ERROR ---
            try {
                await DuprImportError.create({
                    importJobId: jobId,
                    duprMatchId: matchData.duprMatchId,
                    playerName: matchData.players.map(p => p.name).join(', '), 
                    errorType: 'processing',
                    reason: `Processing Failed: ${errorMessage}`,
                    rawData: matchData,
                    createdAt: new Date()
                });
            } catch (dbError) {
                console.error("Failed to save DuprImportError:", dbError);
            }
            
            logError(error, { message: `Error processing DUPR match (Row ${rowNumber})` });
            await jobService.addResult(jobId, { 
              row: rowNumber, status: 'server_error', message: "Error processing match.", data: rowContextData 
            });
          } finally {
            await session.endSession();
          }
        }

        // --- 4. BATCH COMPLETE: SEND EMAILS ---
        console.log(`Batch complete. Processing emails for ${batchEmailContext.size} users...`);
        
        // Inside your app/api/admin/dupr-process/start/route.ts ...

batchEmailContext.forEach((context, email) => {
    const hasResetLink = !!context.passwordResetLink;
    const rewardList = Array.from(context.earnedItems);
    const hasRewards = rewardList.length > 0;

    if (hasResetLink || hasRewards) {
        
        let subject = "";
        let headline = `Welcome, ${context.name}!`;
        let bodyText = "";
        let buttonText = "";
        let actionUrl = "";

        if (hasResetLink) {
            actionUrl = context.passwordResetLink!;
            buttonText = "Activate Account";
            if (hasRewards) {
                subject = "Welcome! You've already earned rewards!";
                bodyText = "We've created an account for you based on your recent DUPR activity. Even better, you've already unlocked rewards based on your match history!";
            } else {
                subject = "Welcome to GG Pickleball";
                bodyText = "We've created an account for you based on your recent DUPR activity. Please activate your account to view your stats.";
            }
        } else {
            subject = "You unlocked a new reward!";
            headline = "New Reward Unlocked!";
            bodyText = `Great job, ${context.name}! Your recent match activity has unlocked new rewards.`;
            buttonText = "View Rewards";
            actionUrl = `https://www.${process.env.NEXT_PUBLIC_BASE_URL}.com/play`;
        }

        // --- THIS IS WHERE WE PASS THE REWARD LIST ---
        // Notice how we join the array here before passing it to the generic variables object
        const finalRewardListString = hasRewards ? rewardList.join(", ") : undefined;

        sendNotificationEmail({
            email: email,
            template: 'gg_universal_notification',
            subject: subject,
            variables: {
                headline: headline,
                body_text: bodyText,
                button_text: buttonText,
                action_url: actionUrl,
                reward_list: finalRewardListString // <--- Handled here!
            }
        }).catch((err: unknown) => console.error(`Email send failed for ${email}`, err));
    }
});

        await jobService.complete(jobId, 'complete');

      } catch (error: unknown) {
        console.error("Catastrophic error:", error);
        logError(error, { message: 'Critical error in DUPR job', jobId });
        await jobService.addResult(jobId, { row: 0, status: 'server_error', message: 'Critical job failure.', data: { players: [], score: 'N/A' } });
        await jobService.complete(jobId, 'failed');
      }
    })();
    
    return NextResponse.json({ jobId, totalRows: totalGamesToProcess });

  } catch (error) {
    logError(error, { message: 'Failed to start DUPR upload job.' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}