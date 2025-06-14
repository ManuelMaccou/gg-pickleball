'use server'

import { Types, UpdateQuery } from 'mongoose';
import User from '@/app/models/User';
import { ClientStats, IAchievement, IReward, IUser, SerializedAchievement } from '@/app/types/databaseTypes';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { DateTime } from 'luxon';
import Achievement from '@/app/models/Achievement';
import Reward from '@/app/models/Reward';
import { getRewardCodeGenerator } from '@/lib/rewards/rewardCodeGenerators';

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

type VisitResult = {
  achievements: AchievementEarned[];
  didVisit: boolean;
  visitDate?: Date;
};

type CheckFunction = (user: IUser, match: MatchData) => Promise<AchievementEarned[] | VisitResult> | AchievementEarned[] | VisitResult;

const achievementFunctionMap: Record<string, CheckFunction> = {
  'visit-1': visit,
  'visit-5': visit,
  'visit-10': visit,
  'visit-20': visit,
  'visit-50': visit,
  'visit-100': visit,
  'first-win': firstWin,
  '2-win-streak': winStreak,
  '5-win-streak': winStreak,
  '10-win-streak': winStreak,
  'win-streak-breaker': winStreakBreaker,
  '5-matches-played': matchesPlayed,
  '10-matches-played': matchesPlayed,
  '20-matches-played': matchesPlayed,
  '50-matches-played': matchesPlayed,
  'century-club': matchesPlayed,
  'pickle': pickle,
  '50-points-won': pointsWon,
  '100-points-won': pointsWon,
  '200-points-won': pointsWon,
  '300-points-won': pointsWon,
  '400-points-won': pointsWon,
  '500-points-won': pointsWon,
};

function ensureClientStats(user: IUser, clientId: string): ClientStats {
  if (!user.stats || !(user.stats instanceof Map)) {
    user.stats = new Map<string, ClientStats>();
  }

  let clientStats = user.stats?.get(clientId);

  if (!clientStats) {
    clientStats = {
      visits: [],
      wins: 0,
      losses: 0,
      winStreak: 0,
      pointsWon: 0,
      matches: [],
      achievements: [],
      rewards: [],
    };
    user.stats.set(clientId, clientStats);
  }

  return clientStats;
}

function visit(user: IUser, match: MatchData): VisitResult {
  const VISIT_MILESTONES = [1, 5, 10, 20, 50, 100];
  const LA_TIMEZONE = "America/Los_Angeles";
  const now = new Date();

  const nowInLA = DateTime.fromJSDate(now).setZone(LA_TIMEZONE);
  const todayStartInLA = nowInLA.startOf('day');
  const todayEndInLA = nowInLA.endOf('day');

  const userStatsForClient = ensureClientStats(user, match.location);
  userStatsForClient.visits ??= [];

  const alreadyCheckedInToday = userStatsForClient.visits.some((visit) => {
    const visitDate = DateTime.fromJSDate(visit).setZone(LA_TIMEZONE);
    return visitDate >= todayStartInLA && visitDate <= todayEndInLA;
  });

  if (alreadyCheckedInToday) {
    return { achievements: [], didVisit: false };
  }

  userStatsForClient.visits.push(now);

  const totalVisitsAfterToday = userStatsForClient.visits.length;
  for (const milestone of VISIT_MILESTONES) {
    if (totalVisitsAfterToday === milestone) {
      return {
        achievements: [{ key: `visit-${milestone}`, repeatable: false }],
        didVisit: true,
        visitDate: now,
      };
    }
  }

  return { achievements: [], didVisit: true, visitDate: now };
}

function firstWin(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();
  const clientId = match.location;

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
  console.log('win streak earned:', earned)
  return earned;
}

async function winStreakBreaker(user: IUser, match: MatchData): Promise<AchievementEarned[]> {
  
  const earned: AchievementEarned[] = [];
  const userIdStr = user._id.toString();

  if (!match.winners.includes(userIdStr)) return earned;

  // Identify the losing team
  const isTeam1Winner = match.team1Ids.every(id => match.winners.includes(id));
  const losingTeam = isTeam1Winner ? match.team2Ids : match.team1Ids;
  console.log('losing team:', losingTeam)

  try {
    const losingUsers = await User.find({
      _id: { $in: losingTeam.map(id => new Types.ObjectId(id)) },
    });

    console.log('losing users:', losingUsers)

    const streakBroken = losingUsers.some((loser) => {
      const statsMap = loser.stats instanceof Map
        ? loser.stats
        : new Map(Object.entries(loser.stats ?? {}));

      const stats = statsMap.get(match.location);
      console.log(`loser stats for ${loser.name}:`, stats)
      return stats?.winStreak >= 3;
    });

    console.log('win streak broken?:', streakBroken)

    if (streakBroken) {
      earned.push({
        key: "win-streak-breaker",
        repeatable: true,
      });
    }
    console.log("winstreak broken earned, no error:", earned)
    return earned;
  } catch (err) {
    console.error("Error checking win streaks:", err);
    console.log("winstreak broken earned with error:", earned)
    return earned;
  }
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
      const alreadyHas = achievements?.some(ach => ach.name === achievementKey);
  
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

    const client = await Client.findById(location);
    if (!client) {
      throw new Error(`Client with id ${location} not found`);
    }

    const achievementDocs = await Achievement.find({ _id: { $in: client.achievements } });
    const enabledAchievementNames = achievementDocs.map((a) => a.name);

    const enabledCheckFns = new Set<CheckFunction>();
    for (const name of enabledAchievementNames) {
      const fn = achievementFunctionMap[name];
      if (fn) enabledCheckFns.add(fn);
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

    const newAchievementsPerUser: {
      user: IUser;
      newAchievements: AchievementEarned[];
      didVisit: boolean;
      visitDate?: Date;
    }[] = [];

    for (const user of users) {
      const clientStats = ensureClientStats(user, location);
      const allAchievements: AchievementEarned[] = [];
      
      let didVisit = false;
      let visitDate: Date | undefined = undefined;
      
      function isVisitFn(fn: CheckFunction): fn is typeof visit {
        return fn === visit;
      }

      function isVisitResult(val: unknown): val is VisitResult {
        return typeof val === 'object' &&
          val !== null &&
          'achievements' in val &&
          'didVisit' in val;
      }

      for (const check of enabledCheckFns) {
        const result = await check(user, matchData);

        if (isVisitResult(result)) {
          allAchievements.push(...result.achievements);
          didVisit = result.didVisit;
          visitDate = result.visitDate;
        } else {
          allAchievements.push(...result);
        }
      }


      const newAchievements = allAchievements.filter(a => {
        const existing = clientStats.achievements?.some(ach => ach.name === a.key);
        return a.repeatable || !existing;
      });

      newAchievementsPerUser.push({
        user,
        newAchievements,
        didVisit,
        visitDate
      });
    }

    const allNewKeys = [
      ...new Set(newAchievementsPerUser.flatMap((u) => u.newAchievements.map((a) => a.key))),
    ];

    console.log('allNewKeys:', allNewKeys);

    const achievementMap = new Map(
      (await Achievement.find({ name: { $in: allNewKeys } })).map((a) => [a.name, a])
    );

    console.log('achievementMap keys:', [...achievementMap.keys()]);

    const earnedAchievementsList: {
      userId: string;
      achievements: SerializedAchievement[];
    }[] = [];

    // Prepare bulk update operations.
    const bulkOperations: {
      updateOne: { filter: { _id: Types.ObjectId }; update: UpdateQuery<IUser> };
    }[] = [];

    for (const { user, newAchievements, didVisit, visitDate } of newAchievementsPerUser) {
      console.log('new achievements:', newAchievements, 'for user:', user.name);

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

      if (didVisit && visitDate) {
        updateOps.$push ??= {};
        updateOps.$push[`${statsPrefix}.visits`] = visitDate;
      }

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

      const existingAchievementsRaw = user.stats?.get(location)?.achievements;
      const existingAchievements = Array.isArray(existingAchievementsRaw) ? existingAchievementsRaw : [];


      const achievementEntries = newAchievements
        .map(a => {
          const achievementDoc = achievementMap.get(a.key);
          if (!achievementDoc) return null;

          const alreadyEarned = existingAchievements.some(
            entry => entry.name === a.key
          );

          if (!a.repeatable && alreadyEarned) {
            return null; // skip non-repeatables already earned
          }

          return {
            achievementId: achievementDoc._id,
            name: achievementDoc.name,
            earnedAt: new Date()
          };
        })
        .filter((entry): entry is {
          achievementId: Types.ObjectId;
          name: string;
          earnedAt: Date;
        } => !!entry);

      if (achievementEntries.length > 0) {
        updateOps.$push ??= {};
        updateOps.$push[`${statsPrefix}.achievements`] = { $each: achievementEntries };
      }


      const rewardToAchievementId = new Map<string, Types.ObjectId>();

      for (const a of newAchievements) {
        const rewardId = client.rewardsPerAchievement?.get?.(a.key);
        const achievementDoc = achievementMap.get(a.key);
        if (rewardId && achievementDoc) {
          rewardToAchievementId.set(rewardId.toString(), achievementDoc._id);
        }
      }

      const clientId = new Types.ObjectId(location);

      const earnedRewardIds = newAchievements
        .map(a => client.rewardsPerAchievement?.get?.(a.key))
        .filter(Boolean) as Types.ObjectId[];

      const rewards = await Reward.find({ _id: { $in: earnedRewardIds } });

      // Group rewards by category (retail, programming, etc.)
      const rewardsByCategory = new Map<string, IReward[]>();
      for (const reward of rewards) {
        if (!rewardsByCategory.has(reward.category)) {
          rewardsByCategory.set(reward.category, []);
        }
        rewardsByCategory.get(reward.category)!.push(reward);
      }

      let rewardCodeIdMap: Map<string, Types.ObjectId> = new Map();

      for (const [category, rewardsInCategory] of rewardsByCategory.entries()) {
        const software =
          category === 'retail'
            ? client.retailSoftware
            : client.reservationSoftware;

        const generator = getRewardCodeGenerator(category, software);

        if (generator && rewardsInCategory.length > 0) {
          const tasks = rewardsInCategory.map(reward => {
            const achievementId = rewardToAchievementId.get(reward._id.toString());

            if (!achievementId) {
              throw new Error(`Missing achievementId for reward ${reward._id}`);
            }

            return {
              rewardId: reward._id,
              reward,
              achievementId,
              userId: user._id,
              clientId,
            };
          });

          console.log(`Generating ${category} codes using ${software}`, tasks);

          const map = await generator(tasks, clientId);

          // Merge results into one map
          for (const [rewardId, codeId] of map.entries()) {
            rewardCodeIdMap.set(rewardId.toString(), codeId);
          }
        } else {
          console.warn(`No generator found for ${category}:${software}`);
        }
      }
      
      const rewardEntries = earnedRewardIds.map(rewardId => ({
        rewardId,
        earnedAt: new Date(),
        redeemed: false,
        rewardCodeId: rewardCodeIdMap.get(rewardId.toString())
      }));
      
      if (rewardEntries.length > 0) {
        updateOps.$push ??= {};
        updateOps.$push[`${statsPrefix}.rewards`] = { $each: rewardEntries };
        }

      if (Object.keys(updateOps).length > 0) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: user._id },
            update: updateOps,
          }
        });
      }

      const fullAchievements: SerializedAchievement[] = newAchievements
      .map(a => achievementMap.get(a.key))
      .filter((a): a is IAchievement => !!a)
      .map(a => ({
        _id: a._id.toString(),
        index: a.index,
        name: a.name,
        friendlyName: a.friendlyName,
        badge: a.badge,
      }));

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
