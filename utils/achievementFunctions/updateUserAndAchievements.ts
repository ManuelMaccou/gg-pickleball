'use server'

import { Types, UpdateQuery } from 'mongoose';
import User from '@/app/models/User';
import { IClient, IUser } from '@/app/types/databaseTypes';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';

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
  const userIdStr = user._id.toString();
  const clientId = match.location;
  console.log('clientId:', clientId);

  const userStatsForClient = user.stats?.[clientId];

  const { wins } = userStatsForClient;

  if (match.winners.includes(userIdStr) && (!wins || wins === 0)) {
    return [{ key: 'first-win', repeatable: false }];
  }
  return [];
}

function pickle(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();

  const isOnTeam1 = match.team1Ids.includes(userIdStr);
  const isOnTeam2 = match.team2Ids.includes(userIdStr);

  const shutoutByTeam1 = match.team1Score && match.team2Score === 0;
  const shutoutByTeam2 = match.team2Score && match.team1Score === 0;

  if ((isOnTeam1 && shutoutByTeam1) || (isOnTeam2 && shutoutByTeam2)) {
    return [{ key: 'pickle', repeatable: true }];
  }

  return [];
}

function winStreak(user: IUser, match: MatchData): AchievementEarned[] {
  
  const userIdStr = user._id.toString();
  const clientId = match.location;
  const userStatsForClient = user.stats?.[clientId];
  const { winStreak } = userStatsForClient;

  const earned: AchievementEarned[] = [];

  if (match.winners.includes(userIdStr)) {
    if (winStreak === 1) earned.push({ key: '2-win-streak', repeatable: true });
    else if (winStreak === 4) earned.push({ key: '5-win-streak', repeatable: true });
    else if (winStreak === 9) earned.push({ key: '10-win-streak', repeatable: true });
  }

  return earned;
}

function matchesPlayed(user: IUser, match: MatchData): AchievementEarned[] {
  const clientId = match.location;
  const userStatsForClient = user.stats?.[clientId];
  const { matches } = userStatsForClient;

  if (matches?.length === 4) {
    return [{key: '5-matches-played', repeatable: false }]
  } else if (matches?.length === 9) {
    return [{key: '10-matches-played', repeatable: false }]
  } else if (matches?.length === 19) {
    return [{key: '20-matches-played', repeatable: false }]
  } else if (matches?.length === 49) {
    return [{key: '50-matches-played', repeatable: false }]
  } else if (matches?.length === 99) {
    return [{key: 'century-club', repeatable: false }]
  }
  return [];
}

function pointsWon(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();
  const clientId = match.location;
  const userStatsForClient = user.stats?.[clientId];
  const { pointsWon } = userStatsForClient;
  const { achievements } = userStatsForClient;

  const isOnTeam1 = match.team1Ids.includes(userIdStr);
  const isOnTeam2 = match.team2Ids.includes(userIdStr);

  const teamScore = isOnTeam1
    ? match.team1Score
    : isOnTeam2
    ? match.team2Score
    : 0;

    const totalPointsWon = (pointsWon || 0) + teamScore;

    const milestones = [50, 100, 200, 300, 400, 500];
  
    for (const threshold of milestones) {
      const key = `${threshold}-points-won`;
      const alreadyHas = achievements?.[key];
  
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

    const client = await Client.findById(location).lean<IClient>();

    if (!client) {
      throw new Error(`Client with id ${location} not found`);
    }

    // Prepare bulk update operations.
    const bulkOperations = users.reduce<
      Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: UpdateQuery<IUser> } }>
    >((ops, user) => {
      const userIdStr = user._id.toString();
      const isWinner = winners.includes(userIdStr);
      const isOnTeam1 = team1Ids.includes(userIdStr);
      const isOnTeam2 = team2Ids.includes(userIdStr);
      const clientId = location; // location === clientId
      const statsPrefix = `stats.${clientId}`;

      const updateOps: UpdateQuery<IUser> = {
        $setOnInsert: {
          [`${statsPrefix}`]: {} // ensure this path exists if missing
        }
      };

      const teamScore = isOnTeam1
        ? matchData.team1Score
        : isOnTeam2
        ? matchData.team2Score
        : 0;

      // If the user is in the winners array, increment wins and streak.
      if (isWinner) {
        updateOps.$inc = {
          [`${statsPrefix}.wins`]: 1,
          [`${statsPrefix}.winStreak`]: 1,
          [`${statsPrefix}.pointsWon`]: teamScore
        };
      } else {
        updateOps.$inc = {
          [`${statsPrefix}.losses`]: 1,
          [`${statsPrefix}.pointsWon`]: teamScore
        };
        updateOps.$set = {
          [`${statsPrefix}.winStreak`]: 0
        };
      }

      // Add matchId to the user's match history
      updateOps.$addToSet = {
        [`${statsPrefix}.matches`]: new Types.ObjectId(matchId)
      };

      // Run achievement checks
      const earnedAchievements = achievementChecks.flatMap((check) => check(user, matchData));

      const earnedRewardIds = earnedAchievements
        .map((a) => client.rewardsPerAchievement?.[a.key])
        .filter(Boolean) as Types.ObjectId[];

      for (const { key, repeatable } of earnedAchievements) {
        const base = `${statsPrefix}.achievements.${key}`;

        if (repeatable) {
          updateOps.$inc ??= {};
          updateOps.$push ??= {};

          updateOps.$inc[`${base}.count`] = 1;
          updateOps.$push[`${base}.earnedAt`] = new Date();
        } else {
          // Only set it if the user doesn't already have it
          const alreadyHas = user.stats?.[clientId]?.achievements?.[key];
          if (!alreadyHas) {
            updateOps.$set ??= {};
            updateOps.$set[base] = {
              earnedAt: [new Date()]
            };
          }
        }
      }

      for (const rewardId of earnedRewardIds) {
        const rewardPath = `${statsPrefix}.rewards.${rewardId}`;
        const alreadyHasReward = user.stats?.[clientId]?.rewards?.[rewardId.toString()];
        
        if (!alreadyHasReward) {
          updateOps.$set ??= {};
          updateOps.$set[rewardPath] = {
            redeemed: false
          };
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
