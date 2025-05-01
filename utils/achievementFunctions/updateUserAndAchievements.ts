'use server'

import { Types, UpdateQuery } from 'mongoose';
import User from '@/app/models/User';
import { ClientStats, IAchievement, IUser, SerializedAchievement } from '@/app/types/databaseTypes';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { DateTime } from 'luxon';
import Achievement from '@/app/models/Achievement';

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

function ensureClientStats(user: IUser, clientId: string): ClientStats {
  let clientStats = user.stats?.get(clientId);

  if (!clientStats) {
    clientStats = {
      checkins: [],
      wins: 0,
      losses: 0,
      winStreak: 0,
      pointsWon: 0,
      matches: [],
      achievements: new Map(),
      rewards: new Map(),
    };
    user.stats.set(clientId, clientStats);
  }

  return clientStats;
}

function checkin(user: IUser, match: MatchData): AchievementEarned[] {
  const CHECKIN_MILESTONES = [1, 5, 10, 20, 50, 100];
  const LA_TIMEZONE = "America/Los_Angeles";

  const userStatsForClient = ensureClientStats(user, match.location);

  const checkins = userStatsForClient.checkins ?? [];

  const now = new Date();
  const nowInLA = DateTime.fromJSDate(now).setZone(LA_TIMEZONE);
  const todayStartInLA = nowInLA.startOf('day');
  const todayEndInLA = nowInLA.endOf('day');

  const alreadyCheckedInToday = checkins.some((checkin) => {
    if (!checkin) return false;
    const checkinDate = DateTime.fromJSDate(checkin).setZone(LA_TIMEZONE);
    return checkinDate >= todayStartInLA && checkinDate <= todayEndInLA;
  });

  if (alreadyCheckedInToday) {
    return [];
  }

  const totalCheckinsAfterToday = checkins.length + 1; // simulate today's check-in

  for (const milestone of CHECKIN_MILESTONES) {
    if (totalCheckinsAfterToday === milestone) {
      return [{ key: `checkin_${milestone}`, repeatable: false }];
    }
  }

  // No milestone hit
  return [];
}

function firstWin(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();
  const clientId = match.location;
  console.log('clientId:', clientId);

  const userStatsForClient = ensureClientStats(user, clientId);
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
  const userStatsForClient = ensureClientStats(user, clientId);
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
  const userStatsForClient = ensureClientStats(user, clientId);
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
  const userStatsForClient = ensureClientStats(user, clientId);

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
      const achievementKey = `${threshold}-points-won`;
      const alreadyHas = achievements?.has(achievementKey);
  
      if (totalPointsWon >= threshold && !alreadyHas) {
        return [{ key: achievementKey, repeatable: false }];
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
): Promise<{
  success: boolean;
  earnedAchievements: { userId: string; achievements: SerializedAchievement[] }[];
  message: string; updatedUsers: string[]
}> {
  await connectToDatabase();
  try {
    if (team1Ids.length !== 2 || team2Ids.length !== 2) {
      throw new Error('Each team must have exactly 2 members.');
    }

    // Combine all participant IDs into a unique set.
    const participantIdsSet = new Set<string>([...team1Ids, ...team2Ids]);
    const participantObjIds = Array.from(participantIdsSet).map((id) => new Types.ObjectId(id));
    const users = await User.find({ _id: { $in: participantObjIds } });

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

    const achievementChecks: AchievementCheckFn[] = [checkin, firstWin, winStreak, matchesPlayed, pickle, pointsWon];
    const client = await Client.findById(location);

    if (!client) {
      throw new Error(`Client with id ${location} not found`);
    }

    const newAchievementsPerUser: {
      user: IUser;
      newAchievements: AchievementEarned[];
    }[] = [];

    for (const user of users) {
      const clientStats = ensureClientStats(user, location);
      const allAchievements = achievementChecks.flatMap(check => check(user, matchData));

      const newAchievements = allAchievements.filter(a => !clientStats.achievements?.has(a.key));
      if (newAchievements.length > 0) {
        newAchievementsPerUser.push({ user, newAchievements });
      }
    }

    const allNewKeys = [
      ...new Set(newAchievementsPerUser.flatMap(entry => entry.newAchievements.map(a => a.key))),
    ];

    const achievementDocs = await Achievement.find({ name: { $in: allNewKeys } });
    const achievementMap = new Map(achievementDocs.map(a => [a.name, a]));

    const earnedAchievementsList: { userId: string; achievements: SerializedAchievement[] }[] = [];

    // Prepare bulk update operations.
    const bulkOperations: { updateOne: { filter: { _id: Types.ObjectId }, update: UpdateQuery<IUser> } }[] = [];

    for (const { user, newAchievements } of newAchievementsPerUser) {
      const userIdStr = user._id.toString();
      const isWinner = winners.includes(userIdStr);
      const isOnTeam1 = team1Ids.includes(userIdStr);
      const isOnTeam2 = team2Ids.includes(userIdStr);
      const statsPrefix = `stats.${location}`;
      const updateOps: UpdateQuery<IUser> = {};

      const teamScore = isOnTeam1
        ? matchData.team1Score
        : isOnTeam2
        ? matchData.team2Score
        : 0;

      // If the user is in the winners array, increment wins and streak.
      updateOps.$inc = {
        [`${statsPrefix}.${isWinner ? "wins" : "losses"}`]: 1,
        [`${statsPrefix}.pointsWon`]: teamScore
      };

      if (!isWinner) {
        updateOps.$set = { [`${statsPrefix}.winStreak`]: 0 };
      } else {
        updateOps.$inc[`${statsPrefix}.winStreak`] = 1;
      }

      updateOps.$addToSet = {
        [`${statsPrefix}.matches`]: new Types.ObjectId(matchId)
      };

      for (const a of newAchievements) {
        const base = `${statsPrefix}.achievements.${a.key}`;

        if (a.repeatable) {
          updateOps.$inc ??= {};
          updateOps.$push ??= {};
          updateOps.$inc[`${base}.count`] = 1;
          updateOps.$push[`${base}.earnedAt`] = new Date();
        } else {
          updateOps.$set ??= {};
          updateOps.$set[base] = { earnedAt: [new Date()] };
        }
      }

      const earnedRewardIds = newAchievements
        .map(a => client.rewardsPerAchievement?.get?.(a.key))
        .filter(Boolean) as Types.ObjectId[];

      for (const rewardId of earnedRewardIds) {
        const rewardPath = `${statsPrefix}.rewards.${rewardId}`;
        const clientStats = ensureClientStats(user, location);
        const alreadyHas = clientStats.rewards?.has(rewardId.toString());

        if (!alreadyHas) {
          updateOps.$set ??= {};
          updateOps.$set[rewardPath] = { redeemed: false };
        }
      }

      if (Object.keys(updateOps).length > 0) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: user._id },
            update: updateOps,
          }
        });
      }

      const fullAchievements = newAchievements
        .map(a => achievementMap.get(a.key))
        .filter((a): a is SerializedAchievement => !!a);

      earnedAchievementsList.push({
        userId: user._id.toString(),
        achievements: fullAchievements,
      });
    }

    if (!bulkOperations.length) {
      return {
        success: true,
        earnedAchievements: [],
        message: 'No updates required.',
        updatedUsers: [],
      };
    }

    await User.bulkWrite(bulkOperations);


    return {
      success: true,
      earnedAchievements: earnedAchievementsList,
      message: 'User achievements updated successfully.',
      updatedUsers: Array.from(participantIdsSet),
    };
  } catch (error) {
    console.error('Error in updateUserAchievements:', error);
    throw new Error('Failed to update achievements.');
  }
}