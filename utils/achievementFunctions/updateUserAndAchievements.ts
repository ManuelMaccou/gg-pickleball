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
  'visit-15': visit,
  'visit-20': visit,
  'visit-25': visit,
  'visit-30': visit,
  'visit-35': visit,
  'visit-40': visit,
  'visit-45': visit,
  'visit-50': visit,
  'visit-100': visit,
  'first-win': firstWin,
  '5-wins': totalWins,
  '10-wins': totalWins,
  '20-wins': totalWins,
  '30-wins': totalWins,
  '40-wins': totalWins,
  '50-wins': totalWins,
  '100-wins': totalWins,
  '200-wins': totalWins,
  '2-win-streak': winStreak,
  '5-win-streak': winStreak,
  '7-win-streak': winStreak,
  '10-win-streak': winStreak,
  '15-win-streak': winStreak,
  'win-streak-breaker': winStreakBreaker,
  '1-matches-played': matchesPlayed,
  '10-matches-played': matchesPlayed,
  '20-matches-played': matchesPlayed,
  '50-matches-played': matchesPlayed,
  '100-matches-played': matchesPlayed,
  '150-matches-played': matchesPlayed,
  '200-matches-played': matchesPlayed,
  '250-matches-played': matchesPlayed,
  '300-matches-played': matchesPlayed,
  '350-matches-played': matchesPlayed,
  '400-matches-played': matchesPlayed,
  '450-matches-played': matchesPlayed,
  '500-matches-played': matchesPlayed,
  '600-matches-played': matchesPlayed,
  '700-matches-played': matchesPlayed,
  '800-matches-played': matchesPlayed,
  '900-matches-played': matchesPlayed,
  '1000-matches-played': matchesPlayed,
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
  const VISIT_MILESTONES = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100];
  const userStatsForClient = ensureClientStats(user, match.location);
  
   const visitsBeforeThisOne = (userStatsForClient.visits ?? []).length;

  for (const milestone of VISIT_MILESTONES) {
    if (visitsBeforeThisOne === milestone - 1) {
      return {
        achievements: [{ key: `visit-${milestone}`, repeatable: false }],
        didVisit: false // This value is now ignored by the main loop anyway.
      };
    }
  }

  return { achievements: [], didVisit: false };
}

function updateLastVisit(user: IUser, location: string): boolean {
  const LA_TIMEZONE = "America/Los_Angeles";
  const now = new Date();

  const nowInLA = DateTime.fromJSDate(now).setZone(LA_TIMEZONE);
  const todayStartInLA = nowInLA.startOf("day");
  const todayEndInLA = nowInLA.endOf("day");

  const stats = ensureClientStats(user, location);

  const lastVisitDate = stats?.lastVisit
    ? DateTime.fromJSDate(stats?.lastVisit).setZone(LA_TIMEZONE)
    : null;

  const alreadyUpdated = lastVisitDate &&
    lastVisitDate >= todayStartInLA &&
    lastVisitDate <= todayEndInLA;

  if (!alreadyUpdated) {
    stats.lastVisit = now;
    return true; // updated
  }

  return false; // not updated
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

function totalWins(user: IUser, match: MatchData): AchievementEarned[] {
  const WIN_MILESTONES = [5, 10, 20, 30, 40, 50, 100, 200];

  const userIdStr = user._id.toString();

  // This achievement is only for winners.
  if (!match.winners.includes(userIdStr)) {
    return [];
  }

  const clientId = match.location;
  const userStatsForClient = ensureClientStats(user, clientId);
  
  const winsBeforeThisMatch = userStatsForClient.wins || 0;

  const newWinCount = winsBeforeThisMatch + 1;

  for (const milestone of WIN_MILESTONES) {
    if (newWinCount === milestone) {
      return [{ key: `${milestone}-wins`, repeatable: false }];
    }
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

/**
 * Checks if a user has reached a win streak milestone.
 * @param user The user document.
 * @param match The data for the current match.
 * @returns An array with the earned achievement, or an empty array.
 */
function winStreak(user: IUser, match: MatchData): AchievementEarned[] {
  const STREAK_MILESTONES = [2, 5, 7, 10, 15];

  const userIdStr = user._id.toString();

  if (!match.winners.includes(userIdStr)) {
    return [];
  }

  const clientId = match.location;
  const userStatsForClient = ensureClientStats(user, clientId);
  
  const streakBeforeThisMatch = userStatsForClient.winStreak || 0;

  const newWinStreak = streakBeforeThisMatch + 1;

  for (const milestone of STREAK_MILESTONES) {
    if (newWinStreak === milestone) {
      return [{ key: `${milestone}-win-streak`, repeatable: true }];
    }
  }

  return [];
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
  const MATCH_MILESTONES = [1, 10, 20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

  const clientId = match.location;
  const userStatsForClient = ensureClientStats(user, clientId);
  
  const matchesPlayedBefore = userStatsForClient.matches?.length || 0;

  const newTotalMatches = matchesPlayedBefore + 1;

  for (const milestone of MATCH_MILESTONES) {
    if (newTotalMatches === milestone) {
      const achievementKey = `${milestone}-matches-played`;
      
      return [{ key: achievementKey, repeatable: false }];
    }
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
      lastVisitDate?: Date;
    }[] = [];

    for (const user of users) {
      const clientStats = ensureClientStats(user, location);
      const allAchievements: AchievementEarned[] = [];

      

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
        } else {
          allAchievements.push(...result);
        }
      }
      
      const LA_TIMEZONE = "America/Los_Angeles";
      const now = new Date();
      const nowInLA = DateTime.fromJSDate(now).setZone(LA_TIMEZONE);
      const todayStartInLA = nowInLA.startOf('day');
      const todayEndInLA = nowInLA.endOf('day');

      clientStats.visits ??= [];
      const alreadyCheckedInToday = clientStats.visits.some((visitDate) => {
        const visitInLA = DateTime.fromJSDate(visitDate).setZone(LA_TIMEZONE);
        return visitInLA >= todayStartInLA && visitInLA <= todayEndInLA;
      });

      const didVisit = !alreadyCheckedInToday;
      if (didVisit) {
        clientStats.visits.push(now);
      }

      const lastVisitWasUpdated = updateLastVisit(user, location);
      const lastVisitDate = lastVisitWasUpdated ? new Date() : undefined;

      const newAchievements = allAchievements.filter(a => {
        const existing = clientStats.achievements?.some(ach => ach.name === a.key);
        return a.repeatable || !existing;
      });

      newAchievementsPerUser.push({
        user,
        newAchievements,
        didVisit,
        visitDate: didVisit ? now : undefined,
        lastVisitDate
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

    for (const { user, newAchievements, didVisit, visitDate, lastVisitDate } of newAchievementsPerUser) {
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

      // --- Group all $set operations ---
      if (lastVisitDate) {
        updateOps.$set ??= {};
        updateOps.$set[`${statsPrefix}.lastVisit`] = lastVisitDate;
      }
      if (!isWinner) {
        updateOps.$set ??= {};
        updateOps.$set[`${statsPrefix}.winStreak`] = 0;
      }

      // --- Group all $inc operations ---
      updateOps.$inc ??= {};
      updateOps.$inc[`${statsPrefix}.${isWinner ? "wins" : "losses"}`] = 1;
      updateOps.$inc[`${statsPrefix}.pointsWon`] = teamScore;
      if (isWinner) {
        updateOps.$inc[`${statsPrefix}.winStreak`] = 1;
      }
      
      // --- Group all $addToSet operations ---
      updateOps.$addToSet ??= {};
      updateOps.$addToSet[`${statsPrefix}.matches`] = new Types.ObjectId(matchId);
      
      // --- Group all $push operations ---
      if (didVisit && visitDate) {
        updateOps.$push ??= {};
        updateOps.$push[`${statsPrefix}.visits`] = visitDate;
      }

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
        (updateOps.$push as any)[`${statsPrefix}.achievements`] = { $each: achievementEntries };
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

        console.log('found reward code generator:', generator)
        
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

      if (updateOps.$set && Object.keys(updateOps.$set).length === 0) delete updateOps.$set;
      if (updateOps.$inc && Object.keys(updateOps.$inc).length === 0) delete updateOps.$inc;
      if (updateOps.$push && Object.keys(updateOps.$push).length === 0) delete updateOps.$push;
      if (updateOps.$addToSet && Object.keys(updateOps.$addToSet).length === 0) delete updateOps.$addToSet;

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
