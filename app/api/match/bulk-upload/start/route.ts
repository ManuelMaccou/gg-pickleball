import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { logError } from '@/lib/sentry/logger';
import { v4 as uuidv4 } from 'uuid';
import { BulkUploadPayload, JobResult, RowContextData } from '@/app/types/bulkUploadTypes';
import { validateCsvData } from '@/lib/services/matchBulkUpload/validationService';
import { findOrCreateUserForUpload } from '@/lib/services/matchBulkUpload/userService';
import { createMatch } from '@/lib/services/matchBulkUpload/matchService';
import { jobService } from '@/lib/services/matchBulkUpload/job';


export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (authorizedUser?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { matches, location } = await req.json() as BulkUploadPayload;

    const validationError = validateCsvData(matches);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    
    const jobId = await jobService.create();

    // "Fire-and-forget" - don't await this async function.
    (async () => {
      const newUsersForEmail: { name: string; email: string; link: string }[] = [];
      
      for (let i = 0; i < matches.length; i++) {
        const row = matches[i];
        const rowNumber = i + 2;
        let rowContextData: RowContextData | null = null;
        try {
          // --- Run all steps for one row ---
          const players = [
            { name: row.team1_player1_name, email: row.team1_player1_email },
            { name: row.team1_player2_name, email: row.team1_player2_email },
            { name: row.team2_player1_name, email: row.team2_player1_email },
            { name: row.team2_player2_name, email: row.team2_player2_email },
          ];

          const playerEmails = players.map(p => p.email);

          const playerNames = [
            row.team1_player1_name, row.team1_player2_name,
            row.team2_player1_name, row.team2_player2_name,
          ];

          const scoreText = `${row.team1_score} - ${row.team2_score}`;
          rowContextData = { players: playerNames, score: scoreText };

          // Check for duplicates within a single match
          if (new Set(playerEmails).size !== 4) {
            throw new Error("Row has a duplicate player email. Each player can only appear once per match.");
          }

          // Check scores
          const team1Score = parseInt(row.team1_score, 10);
          const team2Score = parseInt(row.team2_score, 10);
          if (isNaN(team1Score) || isNaN(team2Score)) {
            throw new Error("Invalid score format. Scores must be numbers.");
          }
          if (team1Score === team2Score) {
            throw new Error("Tied scores are not allowed. One team must have a higher score.");
          }

          const userResults = [];
          for (const player of players) {
            // Await each call individually to run them in sequence.
            const result = await findOrCreateUserForUpload(player.name, player.email);
            userResults.push(result);
          }
          
          userResults.forEach((res, index) => {
            if (res.passwordResetLink) {
              newUsersForEmail.push({ 
                name: res.user.name, 
                email: players[index].email, 
                link: res.passwordResetLink 
              });
            }
          });

          const userMap = new Map(userResults.map(res => [res.originalName, res.user._id]));
          const team1Ids = [userMap.get(row.team1_player1_name)!, userMap.get(row.team1_player2_name)!];
          const team2Ids = [userMap.get(row.team2_player1_name)!, userMap.get(row.team2_player2_name)!];
          const winners = team1Score > team2Score ? team1Ids : team2Ids;

          const newMatch = await createMatch({
            location,
            team1Ids, team1Score,
            team2Ids, team2Score,
            winners
          });

          await updateUserAndAchievements(
            team1Ids, team2Ids, winners, location,
            newMatch.matchId, team1Score, team2Score
          );
          
          await jobService.addResult(jobId, {
            row: rowNumber,
            status: 'success',
            message: 'Match processed successfully.',
            data: rowContextData
          });

        } catch (error: unknown) {
          let status: JobResult['status'] = 'server_error';
          let userMessage: string;

          // --- 2. USE A TYPE GUARD ---
          if (error instanceof Error) {
            userMessage = error.message;

            const userFixableErrors = [
              "Row has a duplicate player email",
              "Invalid 'winner_team' value",
              "Invalid score format",
              "Tied scores are not allowed",
              "The email",
              "CSV row is missing a name or email",
            ];

            if (userFixableErrors.some(msg => userMessage.includes(msg))) {
              status = 'user_error';
            } else {
              status = 'server_error';
              userMessage = "An internal server error occurred. We have been notified.";
              logError(error, { 
                message: `Error processing bulk upload row ${rowNumber}`,
                locationId: location,
                rowData: row,
              });
            }
          } else {
            status = 'server_error';
            userMessage = "An unexpected, non-standard error occurred. We have been notified.";
            logError(new Error(String(error)), { 
              message: `Caught non-Error object processing row ${rowNumber}`,
              locationId: location,
              originalError: error,
            });
          }
          
           await jobService.addResult(jobId, {
            row: rowNumber,
            status,
            message: userMessage,
            data: rowContextData,
          });
        }
      }

      // TODO: Call your email sending service with the `newUsersForEmail` array.
      // e.g., sendWelcomeEmails(uniqueNewUsers).catch(err => logError(err));
      
      await jobService.complete(jobId, 'complete');
    })();
    
    return NextResponse.json({ jobId });
  
  } catch (error) {
    logError(error, { message: 'Failed to start bulk upload job.' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}