'use server'

import { Types, UpdateQuery } from 'mongoose';
import User from '@/app/models/User';
import { IUser } from '@/app/types/databaseTypes';
import connectToDatabase from '@/lib/mongodb';

interface MatchData {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
}

type AchievementEarned = {
  key: string;
  repeatable: boolean;
};

type AchievementCheckFn = (user: IUser, match: MatchData) => AchievementEarned[];

function firstWin(user: IUser, match: MatchData): AchievementEarned[] {
  // Use the string representation of the ObjectId for reliable comparison.
  const userIdStr = user._id.toString();
  if (match.winners.includes(userIdStr) && (user.wins === 0 || user.wins == null )) {
    return [{ key: 'first-win', repeatable: false }];
  }
  return [];
}

function pickle(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();

  const isOnTeam1 = match.team1Ids.includes(userIdStr);
  const isOnTeam2 = match.team2Ids.includes(userIdStr);

  const shutoutByTeam1 = match.team1Score === 11 && match.team2Score === 0;
  const shutoutByTeam2 = match.team2Score === 11 && match.team1Score === 0;

  if ((isOnTeam1 && shutoutByTeam1) || (isOnTeam2 && shutoutByTeam2)) {
    return [{ key: 'pickle', repeatable: true }];
  }

  return [];
}

function winStreak(user: IUser, match: MatchData): AchievementEarned[] {
  
  const userIdStr = user._id.toString();
  const earned: AchievementEarned[] = [];

  if (match.winners.includes(userIdStr)) {
    if (user.winStreak === 1) earned.push({ key: '2-win-streak', repeatable: true });
    else if (user.winStreak === 4) earned.push({ key: '5-win-streak', repeatable: true });
    else if (user.winStreak === 9) earned.push({ key: '10-win-streak', repeatable: true });
  }

  return earned;
}

function matchesPlayed(user: IUser): AchievementEarned[] {
  if (user.matches?.length === 4) {
    return [{key: '5-matches-played', repeatable: false }]
  } else if (user.matches?.length === 9) {
    return [{key: '10-matches-played', repeatable: false }]
  } else if (user.matches?.length === 19) {
    return [{key: '20-matches-played', repeatable: false }]
  } else if (user.matches?.length === 49) {
    return [{key: '50-matches-played', repeatable: false }]
  } else if (user.matches?.length === 99) {
    return [{key: 'century-club', repeatable: false }]
  }
  return [];
}

function pointsWon(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();
  const isOnTeam1 = match.team1Ids.includes(userIdStr);
  const isOnTeam2 = match.team2Ids.includes(userIdStr);

  const teamScore = isOnTeam1
    ? match.team1Score
    : isOnTeam2
    ? match.team2Score
    : 0;

    const totalPointsWon = (user.pointsWon || 0) + teamScore;

    const milestones = [50, 100, 200, 300, 400, 500];
  
    for (const threshold of milestones) {
      const key = `${threshold}-points-won`;
      const alreadyHas = user.achievements?.[key];
  
      if (totalPointsWon >= threshold && !alreadyHas) {
        return [{ key, repeatable: false }];
      }
    }
  
    return [];
  }

/**
 * Main function to update user achievements.
 *
 * For each match:
 *  - Retrieves all participating user documents.
 *  - For each user, executes the achievement check functions.
 *  - If the user is a winner, increments the "wins" field.
 *  - If any achievement checks return a new achievement, it’s added to the user’s achievements array.
 *  - Uses a bulkWrite operation for efficiency.
 *
 * @param team1Ids - Array of user IDs for team 1 (expected 2 IDs).
 * @param team2Ids - Array of user IDs for team 2 (expected 2 IDs).
 * @param winners - Array of winning user IDs.
 * @param location - Location string for the match.
 * @returns An object with success status, message, and list of updated user IDs.
 */
export async function updateUserAndAchievements(
  team1Ids: string[],
  team2Ids: string[],
  winners: string[],
  location: string,
  matchId: string,
  team1Score: number,
  team2Score: number,
): Promise<{ success: boolean; message: string; updatedUsers: string[] }> {
  await connectToDatabase();
  try {
    // Basic validation: each team is expected to have exactly 2 members.
    if (team1Ids.length !== 2 || team2Ids.length !== 2) {
      throw new Error('Each team must have exactly 2 members.');
    }

    // Combine all participant IDs into a unique set.
    const participantIdsSet = new Set<string>([...team1Ids, ...team2Ids]);
    const participantObjIds = Array.from(participantIdsSet).map((id) => new Types.ObjectId(id));

    // GET all participating users from the database.
    const users = await User.find({ _id: { $in: participantObjIds } }).lean<IUser[]>();
    if (!users || users.length === 0) {
      throw new Error('No user documents found for the given participants.');
    }

    // Build match data to be passed into each achievement function.
    const matchData: MatchData = {
      team1Ids,
      team2Ids,
      winners,
      location,
      matchId,
      team1Score,
      team2Score,
    };

    const achievementChecks: AchievementCheckFn[] = [firstWin, winStreak, matchesPlayed, pickle, pointsWon];

    // Prepare bulk update operations.
    const bulkOperations = users.reduce<
      Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: UpdateQuery<IUser> } }>
    >((ops, user) => {
      let updateOps: UpdateQuery<IUser> = {};
      const userIdStr = user._id.toString();
      const isWinner = winners.includes(userIdStr);
      const isOnTeam1 = team1Ids.includes(userIdStr);
      const isOnTeam2 = team2Ids.includes(userIdStr);

      const teamScore = isOnTeam1
        ? matchData.team1Score
        : isOnTeam2
        ? matchData.team2Score
        : 0;

      // If the user is in the winners array, increment wins and streak.
      if (isWinner) {
        updateOps.$inc = {
          wins: 1,
          winStreak: 1,
          pointsWon: teamScore,
        };
      } else {
        updateOps.$inc = {
          losses: 1,
          pointsWon: teamScore,
        };
        updateOps.$set = { winStreak: 0 };
      }

      // Add matchId to the user's match history
      if (!updateOps.$addToSet) updateOps.$addToSet = {};
      updateOps.$addToSet.matches = new Types.ObjectId(matchId);


      // Run achievement checks
      const earnedAchievements = achievementChecks.flatMap((check) => check(user, matchData));

      for (const { key, repeatable } of earnedAchievements) {
        const baseField = `achievements.${key}`;

        if (repeatable) {
          if (!updateOps.$inc) updateOps.$inc = {};
          if (!updateOps.$push) updateOps.$push = {};

          updateOps.$inc[`${baseField}.count`] = 1;
          updateOps.$push[`${baseField}.earnedAt`] = new Date();
        } else {
          // Only set it if the user doesn't already have it
          const alreadyHas = user.achievements?.[key];
          if (!alreadyHas) {
            if (!updateOps.$set) updateOps.$set = {};
            updateOps.$set[baseField] = {
              count: 1,
              earnedAt: [new Date()],
            };
          }
        }
      }

      if (Object.keys(updateOps).length > 0) {
        ops.push({
          updateOne: {
            filter: { _id: user._id },
            update: updateOps,
          },
        });
      }

      return ops;
    }, []);




    // If no updates are needed, return early.
    if (bulkOperations.length === 0) {
      return {
        success: true,
        message: 'No updates required.',
        updatedUsers: [],
      };
    }

    console.log('Prepared bulk update ops:', JSON.stringify(bulkOperations, null, 2));

    // Execute bulk update using Mongoose.
    const bulkResult = await User.bulkWrite(bulkOperations);
    console.log('Bulk update result:', bulkResult);

    // Return the list of updated user IDs.
    const updatedUserIds = Array.from(participantIdsSet);


    return {
      success: true,
      message: 'User achievements updated successfully.',
      updatedUsers: updatedUserIds,
    };
  } catch (error: unknown) {
    console.error('Error in updateUserAchievements:', error);
    if (error instanceof Error) {
      throw new Error('Failed to update achievements: ' + error.message);
    }
    throw new Error('Failed to update achievements due to an unknown error.');
  }
}
