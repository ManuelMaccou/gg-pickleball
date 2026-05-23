'use server'

import { ClientSession, Types, UpdateQuery } from 'mongoose';
import User from '@/app/models/User';
import { ClientStats, IAchievement, IClient, IReward, ISourceRewardSponsorship, IUser, SerializedAchievement } from '@/app/types/databaseTypes';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { DateTime } from 'luxon';
import Achievement from '@/app/models/Achievement';
import Reward from '@/app/models/Reward';
import { getRewardCodeGenerator } from '@/lib/rewards/rewardCodeGenerators';
import Match from '@/app/models/Match';
import { achievementDefinitions } from '@/lib/achievements/definitions';
import RewardCode from '@/app/models/RewardCode';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';

interface MatchData {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
  matchDate: Date;
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

type CheckFunction = (
  user: IUser,
  match: MatchData,
  options: { session: ClientSession }
) => Promise<AchievementEarned[] | VisitResult> | AchievementEarned[] | VisitResult;

type RequiredDbOptions = { session: ClientSession };

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
      // matches: [],
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
  const currentVisits = (userStatsForClient.visits ?? []).length; // Get CURRENT visit count

  for (const milestone of VISIT_MILESTONES) {
    if (currentVisits === milestone) { // Check CURRENT value
      return {
        achievements: [{ key: `visit-${milestone}`, repeatable: false }],
        didVisit: false
      };
    }
  }
  return { achievements: [], didVisit: false };
}

function updateLastVisit(user: IUser, location: string, dateToLog: Date): boolean {
  const stats = ensureClientStats(user, location);
  const existingLastVisit = stats.lastVisit;

  // This single condition handles all scenarios correctly.
  // We only update if:
  //   a) There is no existing last visit, OR
  //   b) The new date we are logging is strictly more recent than the existing one.
  if (!existingLastVisit || dateToLog > existingLastVisit) {
    stats.lastVisit = dateToLog;
    return true; // An update occurred.
  }

  // If the new date is older or the same, we do nothing to preserve the true last visit.
  return false; // No update occurred.
}

function firstWin(user: IUser, match: MatchData): AchievementEarned[] {
  const userIdStr = user._id.toString();
  const userStatsForClient = ensureClientStats(user, match.location);
  const { wins } = userStatsForClient;

  // With the new pattern, if this is their first win, the `wins` count will be exactly 1.
  if (match.winners.includes(userIdStr) && wins === 1) { 
    return [{ key: 'first-win', repeatable: false }];
  }
  return [];
}

function totalWins(user: IUser, match: MatchData): AchievementEarned[] {
  const WIN_MILESTONES = [5, 10, 20, 30, 40, 50, 100, 200];
  const userIdStr = user._id.toString();

  if (!match.winners.includes(userIdStr)) {
    return [];
  }

  const clientId = match.location;
  const userStatsForClient = ensureClientStats(user, clientId);
  const currentWins = userStatsForClient.wins || 0; // Get the CURRENT win count

  for (const milestone of WIN_MILESTONES) {
    if (currentWins === milestone) { // Check the CURRENT value
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

function duprWins(user: IUser, match: MatchData): AchievementEarned[] {
  const DUPR_WIN_MILESTONES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const userIdStr = user._id.toString();

  if (!match.winners.includes(userIdStr)) {
    return [];
  }

  const userGlobalStats = ensureClientStats(user, 'global');
  const currentGlobalWins = userGlobalStats.wins || 0; // Get CURRENT global wins

  for (const milestone of DUPR_WIN_MILESTONES) {
    if (currentGlobalWins === milestone) { // Check CURRENT value
      const achievementKey = `${milestone}-dupr-matches-won`;
      return [{ key: achievementKey, repeatable: false }];
    }
  }
  return [];
}

/**
 * Checks if a user has reached a win streak milestone.
 * @param user The user document.
 * @param match The data for the current match.
 * @returns An array with the earned achievement, or an empty array.
 */
function winStreak(
  user: IUser,
  match: MatchData,
): AchievementEarned[] {
  const STREAK_MILESTONES = [2, 5, 7, 10, 15];
  const userIdStr = user._id.toString();

  if (!match.winners.includes(userIdStr)) {
    return [];
  }

  const userStatsForClient = ensureClientStats(user, match.location);
  const currentWinStreak = userStatsForClient.winStreak || 0; // Get CURRENT streak

  for (const milestone of STREAK_MILESTONES) {
    if (currentWinStreak === milestone) { // Check CURRENT value
      return [{ key: `${milestone}-win-streak`, repeatable: true }];
    }
  }
  return [];
}

async function winStreakBreaker(
  user: IUser,
  match: MatchData,
  options: { session: ClientSession }
): Promise<AchievementEarned[]> {
  
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
    }).session(options.session);

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

async function matchesPlayed(
  user: IUser,
  match: MatchData,
  options: { session: ClientSession }
): Promise<AchievementEarned[]> {
  const MATCH_MILESTONES = [1, 10, 20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];
  const userId = new Types.ObjectId(user._id);
  
  const query: any = {
    $or: [
      { 'team1.players': userId },
      { 'team2.players': userId }
    ]
  };

  // If location is 'global', do not filter by location.
  if (match.location !== 'global') {
    query.location = new Types.ObjectId(match.location);
  }

  // This counts matches BEFORE the current one is saved.
  const matchesPlayedBeforeThisOne = await Match.countDocuments(query)
    .session(options.session);
  
  // We simulate the new total here because the match isn't saved yet when this check is planned to run.
  // This is a special case compared to other stats.
  const totalMatchesAfterThisOne = matchesPlayedBeforeThisOne + 1;

  for (const milestone of MATCH_MILESTONES) {
    if (totalMatchesAfterThisOne === milestone) {
      const achievementKey = `${milestone}-matches-played`;
      return [{ key: achievementKey, repeatable: false }];
    }
  }

  return [];
}

function pointsWon(user: IUser, match: MatchData): AchievementEarned[] {
  const clientId = match.location;
  const userStatsForClient = ensureClientStats(user, clientId);
  const currentPointsWon = userStatsForClient.pointsWon || 0; // Get CURRENT points
  const achievements = userStatsForClient.achievements;
  const milestones = [50, 100, 200, 300, 400, 500];
  
  for (const threshold of milestones) {
    const achievementKey = `${threshold}-points-won`;
    const alreadyHas = achievements?.some(ach => ach.name === achievementKey);

    if (currentPointsWon >= threshold && !alreadyHas) { // Check CURRENT value
      return [{ key: achievementKey, repeatable: false }];
    }
  }
  return [];
}

const functionImplementations: Record<string, CheckFunction> = {
  visit,
  firstWin,
  totalWins,
  winStreak,
  winStreakBreaker,
  matchesPlayed,
  pickle,
  pointsWon,
  duprWins,
};

const achievementFunctionMap = achievementDefinitions.reduce((acc, def) => {
  const func = functionImplementations[def.name];
  if (func) {
    acc[def.key] = func;
  }
  return acc;
}, {} as Record<string, CheckFunction>);

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

type UpdateOptions = {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
  matchDate: Date;
  isHistorical: boolean;
  triggeringEvent?: string;
  dataSourceId?: string;
  targetUserIds?: string[];
  countAsWin?: boolean;
};


/*
 */
async function processLocalMatch(
  options: Omit<UpdateOptions, 'isGlobalContext'>,
  dbOptions: RequiredDbOptions
) {
  const {
    team1Ids, team2Ids, winners, location, matchId,
    team1Score, team2Score, matchDate, isHistorical
  } = options;

    await connectToDatabase();

    const session = dbOptions.session;

  try {

    if (team1Ids.length !== 2 || team2Ids.length !== 2) {
      throw new Error('Each team must have exactly 2 members.');
    }

    const participantIdsSet = new Set<string>([...team1Ids, ...team2Ids]);
    const participantObjIds = Array.from(participantIdsSet).map((id) => new Types.ObjectId(id));

    // --- Initial Fetches ---
    let initialUsers: IUser[], client: IClient | null;

    try {
      [initialUsers, client] = await Promise.all([
        User.find({ _id: { $in: participantObjIds } }).session(session),
        Client.findById(location).session(session)
      ]);
    } catch (e) {
      console.error("[TRANSACTION_DEBUG] FAILURE: Initial User and Client fetch.", e);
      throw e;
    }

    if (!initialUsers || initialUsers.length === 0) throw new Error('No user documents found.');
    if (!client) throw new Error(`Client with id ${location} not found`);

    // --- PHASE 1: PREPARE AND EXECUTE CORE STAT UPDATES ---
    const statUpdateOps: any[] = [];
    const visitDataPerUser = new Map<string, { didVisit: boolean, visitDate?: Date, lastVisitDate?: Date }>();

    // Pre-calculate visit data before building the update
    for (const user of initialUsers) {
      const clientStats = ensureClientStats(user, location);
      const dateForVisit = isHistorical ? matchDate : new Date();
      
      const LA_TIMEZONE = "America/Los_Angeles";
      const dayOfMatchInLA = DateTime.fromJSDate(dateForVisit).setZone(LA_TIMEZONE);
      const startOfDayOfMatch = dayOfMatchInLA.startOf('day');
      const endOfDayOfMatch = dayOfMatchInLA.endOf('day');

      const alreadyCheckedInForThisDay = (clientStats.visits ?? []).some((visitDate) => {
        const visitInLA = DateTime.fromJSDate(visitDate).setZone(LA_TIMEZONE);
        return visitInLA >= startOfDayOfMatch && visitInLA <= endOfDayOfMatch;
      });

      const didVisit = !alreadyCheckedInForThisDay;
      const lastVisitDate = updateLastVisit(user, location, dateForVisit) ? dateForVisit : undefined;
      visitDataPerUser.set(user._id.toString(), { didVisit, visitDate: didVisit ? dateForVisit : undefined, lastVisitDate });
    }

    // Build the bulk update operations
    for (const user of initialUsers) {
      const userIdStr = user._id.toString();
      const isWinner = winners.includes(userIdStr);
      const teamScore = team1Ids.includes(userIdStr) ? team1Score : team2Score;
      const userVisitData = visitDataPerUser.get(userIdStr)!;
      const statsPrefix = `stats.${location}`;
      
      const update: UpdateQuery<IUser> = { $inc: {}, $set: {}, $push: {} };

      // Set operations
      if (userVisitData.lastVisitDate) {
        update.$set![`${statsPrefix}.lastVisit`] = userVisitData.lastVisitDate;
      }
      if (!isWinner && !isHistorical) { // Don't reset streak for historical matches
        update.$set![`${statsPrefix}.winStreak`] = 0;
      }

      // Increment operations
      update.$inc![`${statsPrefix}.${isWinner ? "wins" : "losses"}`] = 1;
      update.$inc![`${statsPrefix}.pointsWon`] = teamScore;
      if (isWinner && !isHistorical) {
        update.$inc![`${statsPrefix}.winStreak`] = 1;
      }
      
      // Push operations
      if (userVisitData.didVisit && userVisitData.visitDate) {
        update.$push![`${statsPrefix}.visits`] = userVisitData.visitDate;
      }

      // Clean up empty operators
      if (Object.keys(update.$set!).length === 0) delete update.$set;
      if (Object.keys(update.$inc!).length === 0) delete update.$inc;
      if (Object.keys(update.$push!).length === 0) delete update.$push;
      
      statUpdateOps.push({ updateOne: { filter: { _id: user._id }, update, upsert: true } });
    }

    if (statUpdateOps.length > 0) {
      try {
        await User.bulkWrite(statUpdateOps, { session });
      } catch (e) {
        console.error("[TRANSACTION_DEBUG] FAILURE: Phase 1 User.bulkWrite for stats.", e);
        throw e;
      }
    }

    // --- PHASE 2: CALCULATE ACHIEVEMENTS AND REWARDS WITH UPDATED STATS ---
    let updatedUsers;

    try {
      updatedUsers = await User.find({ _id: { $in: participantObjIds } }).session(session);
    } catch (e) {
      console.error("[TRANSACTION_DEBUG] FAILURE: Refetching users for Phase 2.", e);
      throw e;
    }

    let enabledAchievementKeys;
    
    try {
      enabledAchievementKeys = new Set((await Achievement.find({ _id: { $in: client.achievements } }).session(session)).map(a => a.name));
    } catch (e) {
      console.error("[TRANSACTION_DEBUG] FAILURE: Fetching enabled achievements.", e);
      throw e;
    }
    
    const enabledCheckFunctions = new Set<CheckFunction>();
    for (const key of enabledAchievementKeys) {
      const func = achievementFunctionMap[key as string];
      if (func) enabledCheckFunctions.add(func);
    }
    
    const matchData: MatchData = { team1Ids, team2Ids, winners, location, matchId, team1Score, team2Score, matchDate };
    const newAchievementsPerUser = new Map<string, AchievementEarned[]>();
    const allNewKeys = new Set<string>();

    for (const user of updatedUsers) {
      const clientStats = ensureClientStats(user, location);
      const allAchievements: AchievementEarned[] = [];

      for (const checkFn of enabledCheckFunctions) {
        if (isHistorical && (checkFn === winStreak || checkFn === winStreakBreaker)) continue;

        try {
          // IMPORTANT: This calls helper functions that might have DB queries
          const result = await checkFn(user, matchData, { session });
          allAchievements.push(...(Array.isArray(result) ? result : result.achievements));
        } catch (e) {
          console.error(`[TRANSACTION_DEBUG] FAILURE: Inside check function '${checkFn.name}'.`, e);
          throw e;
        }
      }

      const newAchievements = allAchievements.filter(a => {
        const existing = clientStats.achievements?.some(ach => ach.name === a.key);
        return a.repeatable || !existing;
      });
      if (newAchievements.length > 0) {
        newAchievementsPerUser.set(user._id.toString(), newAchievements);
        newAchievements.forEach(a => allNewKeys.add(a.key));
      }
    }
    
    if (newAchievementsPerUser.size === 0) {
      return {
        success: true,
        earnedAchievements: [],
        message: 'Match stats updated. No new achievements.',
        updatedUsers: Array.from(participantIdsSet)
      };
    }

    let achievementMap;
    try {
      achievementMap = new Map((await Achievement.find({ name: { $in: Array.from(allNewKeys) } }).session(session)).map(a => [a.name, a]));
    } catch (e) {
      console.error("[TRANSACTION_DEBUG] FAILURE: Building achievementMap.", e);
      throw e;
    }
    
const earnedAchievementsList: {
      userId: string;
      email: string;
      name: string; 
      items: string[];
    }[] = [];
    const achievementBulkOps: any[] = [];
    
    for (const user of updatedUsers) {
      const newAchievements = newAchievementsPerUser.get(user._id.toString());
      if (!newAchievements || newAchievements.length === 0) continue;
      
      const updateOps: UpdateQuery<IUser> = {};
      const pushOps: any = {};
      
      const achievementEntries = newAchievements.map(a => {
        const achievementDoc = achievementMap.get(a.key);
        if (!achievementDoc) return null;
        return { achievementId: achievementDoc._id, name: achievementDoc.name, earnedAt: matchDate };
      }).filter((entry): entry is { achievementId: Types.ObjectId; name: string; earnedAt: Date; } => entry !== null);
      
      if (achievementEntries.length > 0) {
        pushOps[`stats.${location}.achievements`] = { $each: achievementEntries };
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

      if (fullAchievements.length > 0) {
         earnedAchievementsList.push({
          userId: user._id.toString(),
          email: user.email || "", 
          name: user.name,
          items: newAchievements.map(a => ({ ...a, name: a.key } as any))
        });
      }

      // Reward generation logic (same as before, remains correct)
      const rewardToAchievementId = new Map<string, Types.ObjectId>();
      for (const a of newAchievements) {
        const rewardId = client.rewardsPerAchievement?.get?.(a.key);
        const achievementDoc = achievementMap.get(a.key);
        if (rewardId && achievementDoc) {
          rewardToAchievementId.set(rewardId.toString(), achievementDoc._id);
        }
      }
      const earnedRewardIds = newAchievements.map(a => client.rewardsPerAchievement?.get?.(a.key)).filter(Boolean) as Types.ObjectId[];
      
      let rewards;
      try {
        rewards = await Reward.find({ _id: { $in: earnedRewardIds } }).session(session);
      } catch (e) {
        console.error(`[TRANSACTION_DEBUG] FAILURE: Fetching rewards for user ${user.name}.`, e);
        throw e;
      }
      
      const rewardsByCategory = new Map<string, IReward[]>();
      for (const reward of rewards) {
        if (!rewardsByCategory.has(reward.category)) rewardsByCategory.set(reward.category, []);
        rewardsByCategory.get(reward.category)!.push(reward);
      }
      let rewardCodeIdMap = new Map<string, Types.ObjectId>();
      for (const [category, rewardsInCategory] of rewardsByCategory.entries()) {
        const software = category === 'retail' ? client.retailSoftware : client.reservationSoftware;
        const generator = getRewardCodeGenerator(category, software);
        
        if (generator && rewardsInCategory.length > 0) {
          try {
            const tasks = rewardsInCategory.map(reward => {
              const achievementId = rewardToAchievementId.get(reward._id.toString());
              if (!achievementId) throw new Error(`Missing achievementId for reward ${reward._id}`);
              return {
                rewardId: reward._id,
                reward, achievementId,
                userId: user._id,
                clientId: client._id,
                isGlobalReward: false,
              };
            });
          
            const map = await generator(tasks, client._id, { session });
          
            for (const [rewardId, codeId] of map.entries()) {
              rewardCodeIdMap.set(rewardId.toString(), codeId);
            }
            
          } catch (e) {
            console.error(`[TRANSACTION_DEBUG] FAILURE: Inside generator for category '${category}'.`, e);
            throw e;
          }
        }
      }
      const rewardEntries = earnedRewardIds.map(rewardId => ({
        rewardId, earnedAt: matchDate, redeemed: false, rewardCodeId: rewardCodeIdMap.get(rewardId.toString())
      }));
      if (rewardEntries.length > 0) {
        pushOps[`stats.${location}.rewards`] = { $each: rewardEntries };
      }

      if (Object.keys(pushOps).length > 0) {
        updateOps.$push = pushOps;
        achievementBulkOps.push({ updateOne: { filter: { _id: user._id }, update: updateOps } });
      }
    }
    
    if (achievementBulkOps.length > 0) {
      try {
        await User.bulkWrite(achievementBulkOps, { session });
      } catch (e) {
        console.error("[TRANSACTION_DEBUG] FAILURE: Phase 2 User.bulkWrite for achievements/rewards.", e);
        throw e;
      }
    }

    return { success: true,
      earnedAchievements: earnedAchievementsList,
      message: 'User achievements updated successfully.',
      updatedUsers: Array.from(participantIdsSet)
    };

  } catch (error) {
    console.error('Error in processLocalMatch:', error);
    throw error;
  }
}

async function processGlobalMatch(
  options: Omit<UpdateOptions, 'isGlobalContext' | 'location'> & { dataSourceId: string },
  dbOptions: RequiredDbOptions 
) {

  const session = dbOptions.session;

  const {
    team1Ids, team2Ids, winners, matchId,
    team1Score, team2Score, matchDate, triggeringEvent,
    dataSourceId
  } = options;

  await connectToDatabase();
  try {
     if (team1Ids.length !== 2 || team2Ids.length !== 2) {
      throw new Error('Each team must have exactly 2 members.');
    }

    const participantIdsSet = new Set<string>([...team1Ids, ...team2Ids]);
    const participantObjIds = Array.from(participantIdsSet)
      // FIX: Only convert valid ObjectIds
      .filter(id => Types.ObjectId.isValid(id)) 
      .map((id) => new Types.ObjectId(id));

    const sourceConfigs = await SourceRewardConfig.find({ dataSourceId: dataSourceId }).session(session);

    if (!sourceConfigs || sourceConfigs.length === 0) {
      return { success: true, earnedAchievements: [], message: 'No source config found.', updatedUsers: [] };
    }

    const sourceRewardConfigMap = new Map<string, ISourceRewardSponsorship[]>();
    for (const config of sourceConfigs) {
      sourceRewardConfigMap.set(config.achievementName, config.sponsorships);
    }

    // --- PHASE 1: UPDATE CORE STATS (WINS, LOSSES, POINTS) ---
    const statUpdateOps: any[] = [];
    for (const userId of participantIdsSet) {
      if (options.targetUserIds && !options.targetUserIds.includes(userId)) {
          continue;
        }

        const isWinner = winners.includes(userId);
        const isOnTeam1 = team1Ids.includes(userId);
        const teamScore = isOnTeam1 ? team1Score : team2Score;
        
        statUpdateOps.push({
            updateOne: {
                filter: { _id: new Types.ObjectId(userId) },
                update: {
                    $inc: {
                      'stats.global.wins': (isWinner && options.countAsWin) ? 1 : 0,
                      'stats.global.losses': (!isWinner && options.countAsWin) ? 1 : 0,
                      'stats.global.pointsWon': teamScore,
                    }
                },
                upsert: true // Ensures stats.global object is created
            }
        });
    }

    if (statUpdateOps.length > 0) {
      await User.bulkWrite(statUpdateOps, { session });
    }

    // --- PHASE 2: CALCULATE ACHIEVEMENTS AND REWARDS WITH UPDATED STATS ---
    
    const updatedUsers = await User.find({ _id: { $in: participantObjIds } }).session(session);
    if (!updatedUsers || updatedUsers.length === 0) {
      console.error('[DEBUG] EXIT: Could not find users after stat update.');
      throw new Error('Could not find users after stat update.');
    }

    // Determine which global achievements are enabled based on ggrConfig.globalRewardConfig
    const enabledGlobalAchievementKeys = new Set(Array.from(sourceRewardConfigMap.keys()));
    const enabledCheckFunctions = new Set<CheckFunction>();

    for (const key of enabledGlobalAchievementKeys) {
     const func = achievementFunctionMap[key as string]; 
      if (func) {
        enabledCheckFunctions.add(func);
      } 
    }

    if (enabledCheckFunctions.size === 0) {
        console.warn("[DEBUG] WARNING: No check functions were enabled. The `achievementFunctionMap` might be missing keys from GGRConfig.");
    }

    const matchData: MatchData = {
      team1Ids,
      team2Ids,
      winners,
      location: 'global',
      matchId,
      team1Score,
      team2Score,
      matchDate,
    };

    const newAchievementsPerUser = new Map<string, AchievementEarned[]>();
    const allNewKeys = new Set<string>();

    for (const user of updatedUsers) {
      const userGlobalStats = ensureClientStats(user, 'global');      
      const allAchievements: AchievementEarned[] = [];

      for (const checkFn of enabledCheckFunctions) {
        const result = await checkFn(user, matchData, { session });

         if (Array.isArray(result) && result.length > 0) {
            console.log(`[DEBUG] Check function '${checkFn.name}' returned achievements:`, result);
        }

        allAchievements.push(...result as AchievementEarned[]);
      }

      const newAchievements = allAchievements.filter(a => {
        const existing = userGlobalStats.achievements?.some(ach => ach.name === a.key);
       if (!a.repeatable && existing) {
          return false;
        }
        return true;
      });

     if (newAchievements.length > 0) {
        newAchievementsPerUser.set(user._id.toString(), newAchievements);
        newAchievements.forEach(a => allNewKeys.add(a.key));
      }
    }

   if (newAchievementsPerUser.size === 0) {
      return {
        success: true,
        earnedAchievements: [],
        message: 'Match stats updated. No new achievements.',
        updatedUsers: Array.from(participantIdsSet)
      };
    }

    const earnedAchievementsList: {
      userId: string;
      email: string;
      name: string; 
      items: string[];
    }[] = [];

    const achievementBulkOps: any[] = [];

    // Pre-fetch Achievement Docs to get friendly names
    const achievementDocs = await Achievement.find({ name: { $in: Array.from(allNewKeys) } }).session(session);
    const achievementMap = new Map(achievementDocs.map((a) => [a.name, a]));

    for (const user of updatedUsers) {
      // 2. Temp list for this user
      const userEarnedItems: string[] = [];

      const newAchievements = newAchievementsPerUser.get(user._id.toString());

       // --- A. COLLECT ACHIEVEMENTS ---
      if (newAchievements && newAchievements.length > 0) {
        newAchievements.forEach(a => {
          // Get Friendly Name
          const doc = achievementMap.get(a.key);
          const displayName = doc?.friendlyName || doc?.name || a.key;
          userEarnedItems.push(displayName);
        });
      }
      
      if ((!newAchievements || newAchievements.length === 0) && !sourceRewardConfigMap.size) {
        continue; 
      }

      const userGlobalStats = ensureClientStats(user, 'global');
      const existingAchievements = userGlobalStats.achievements || [];
      const existingRewards = userGlobalStats.rewards || [];

      const newAchievementEntries = (newAchievements || []).map(a => {
        const achievementDoc = achievementMap.get(a.key);

         if (!achievementDoc) {
          console.error(`[DIAGNOSTIC] 🔴 CRITICAL FAILURE for user ${user.name}: Could not find achievement with key '${a.key}' in the achievementMap. THIS IS THE PROBLEM. Check for a name mismatch in the database!`);
        }

        if (!achievementDoc) return null;
          return {
            achievementId: achievementDoc._id,
            name: achievementDoc.name,
            earnedAt: matchDate,
            ...(triggeringEvent && { triggeringEvent: triggeringEvent })
          };
        }).filter((entry): entry is {
          achievementId: Types.ObjectId;
          name: string;
          earnedAt: Date;
          triggeringEvent?: string;
        } => entry !== null);

      const finalAchievements = [...existingAchievements, ...newAchievementEntries];

      const rewardToAchievementId = new Map<string, Types.ObjectId>();
      const earnedRewardSponsorships: { rewardId: Types.ObjectId; sponsoringClientId: Types.ObjectId }[] = [];

      for (const a of (newAchievements || [])) {
        const globalSponsorships = sourceRewardConfigMap.get(a.key); 
        const achievementDoc = achievementMap.get(a.key);
        if (globalSponsorships && achievementDoc) {
          for (const sponsorship of globalSponsorships) {
            if (!a.repeatable) {
              const existingCode = await RewardCode.findOne({
                userId: user._id,
                achievementId: achievementDoc._id,
                isGlobalReward: true,
                clientId: sponsorship.sponsoringClientId // Check if sponsored by this specific client
              }).session(session);
              if (existingCode) {
                continue; // Skip this reward, it's already been given
              }
            }
            earnedRewardSponsorships.push(sponsorship);
            rewardToAchievementId.set(sponsorship.rewardId.toString(), achievementDoc._id);
          }
        }
      }

      const uniqueRewardIds = [...new Set(earnedRewardSponsorships.map(s => s.rewardId.toString()))].map(id => new Types.ObjectId(id));
      const uniqueSponsoringClientIds = [...new Set(earnedRewardSponsorships.map(s => s.sponsoringClientId.toString()))].map(id => new Types.ObjectId(id));
      
      const [rewards, sponsoringClients] = await Promise.all([
        Reward.find({ _id: { $in: uniqueRewardIds } }).session(session),
        Client.find({ _id: { $in: uniqueSponsoringClientIds } }).session(session),
      ]);

      const rewardsById = new Map(rewards.map(r => [r._id.toString(), r]));
      const clientsById = new Map(sponsoringClients.map(c => [c._id.toString(), c]));
      const tasksByClient = new Map<string, any[]>();

      for (const sponsorship of earnedRewardSponsorships) {
        const clientIdStr = sponsorship.sponsoringClientId.toString();
        if (!tasksByClient.has(clientIdStr)) {
          tasksByClient.set(clientIdStr, []);
        }
        tasksByClient.get(clientIdStr)!.push(sponsorship);
      }
    
      let rewardCodeIdMap = new Map<string, Types.ObjectId>();

      for (const [clientIdStr, sponsorshipsForClient] of tasksByClient.entries()) {
        const client = clientsById.get(clientIdStr);
        if (!client) {
          continue;
        }

        const tasksByCategory = new Map<string, any[]>();
        for (const sponsorship of sponsorshipsForClient) {
          const reward = rewardsById.get(sponsorship.rewardId.toString());
          if (!reward) continue;
          if (!tasksByCategory.has(reward.category)) {
            tasksByCategory.set(reward.category, []);
          }
          const achievementId = rewardToAchievementId.get(reward._id.toString());
          if (!achievementId) continue;

          tasksByCategory.get(reward.category)!.push({
            rewardId: reward._id,
            reward, achievementId,
            userId: user._id,
            clientId: sponsorship.sponsoringClientId,
            isGlobalReward: true,
            dataSourceId: new Types.ObjectId(dataSourceId),
          });
        }

        for (const [category, tasks] of tasksByCategory.entries()) {
          const software = category === 'retail' ? client.retailSoftware : client.reservationSoftware;
          const generator = getRewardCodeGenerator(category, software);

          if (generator) {
            const map = await generator(tasks, client._id, { session }); 
              
            for (const [rewardId, codeId] of map.entries()) {
              rewardCodeIdMap.set(rewardId, codeId);
            }            
          } else {
            console.warn(`No generator for client ${client.name}, category:${category}, software:${software}`);
          }
        }
      }
      
      const newRewardEntries = earnedRewardSponsorships.map(sponsorship => {
        const codeId = rewardCodeIdMap.get(sponsorship.rewardId.toString());
        if (!codeId) return null;

        // CAPTURE REWARD NAME
        const rewardDoc = rewardsById.get(sponsorship.rewardId.toString());
        if (rewardDoc) {
          const displayName = rewardDoc.friendlyName || rewardDoc.name || "Unknown Reward";
          userEarnedItems.push(displayName);
        }

        return {
          rewardId: sponsorship.rewardId,
          earnedAt: matchDate,
          redeemed: false,
          rewardCodeId: codeId,
          sponsoringClientId: sponsorship.sponsoringClientId,
          triggeringEvent: triggeringEvent,
        };
      }).filter((entry): entry is any => entry !== null);


      const finalRewards = [...existingRewards, ...newRewardEntries];

      
      const setOps: any = {};

      if (newAchievementEntries.length > 0) {
        setOps['stats.global.achievements'] = finalAchievements;
      }

      if (newRewardEntries.length > 0) {
        setOps['stats.global.rewards'] = finalRewards;
      }
      
      if (Object.keys(setOps).length > 0) {
        const updateOperation = {
          updateOne: {
            filter: { _id: user._id },
            update: { $set: setOps }
          }
        };
        achievementBulkOps.push(updateOperation);
      }

      if (userEarnedItems.length > 0) {
        earnedAchievementsList.push({
          userId: user._id.toString(),
          email: user.email || "",
          name: user.name,
          items: userEarnedItems
        });
      }
      
    }

    if (achievementBulkOps.length > 0) {
      await User.bulkWrite(achievementBulkOps, { session });
    }

    return {
        success: true,
        earnedAchievements: earnedAchievementsList,
        message: 'Global match processed successfully.',
        updatedUsers: Array.from(participantIdsSet),
    };
  } catch (error) {
    throw error;
  }
}

// The options for the match data itself remain the same
type UpdateOptionsWithContext = UpdateOptions & { isGlobalContext: boolean };

export async function updateUserAndAchievements(
  options: UpdateOptionsWithContext, 
  dbOptions: RequiredDbOptions 
) {
  const { isGlobalContext, ...restOfOptions } = options;

  if (isGlobalContext) {
    if (!restOfOptions.dataSourceId) {
      throw new Error("dataSourceId is required for global match processing.");
    }
    // 2. Pass the dbOptions object down to the next function
    return await processGlobalMatch(
      restOfOptions as Omit<UpdateOptions, 'isGlobalContext' | 'location'> & { dataSourceId: string },
      dbOptions 
    );
  } else {
    if (!options.location) {
      throw new Error("locationId is required for local match processing.");
    }
    // 2. Also pass it to the local match function for consistency
    return await processLocalMatch(restOfOptions, dbOptions); 
  }
}
