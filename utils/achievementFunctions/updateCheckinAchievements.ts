import { IUser } from "@/app/types/databaseTypes";
import { DateTime } from "luxon";

const CHECKIN_MILESTONES = [1, 5, 10, 20, 50, 100];
const LA_TIMEZONE = "America/Los_Angeles";

/**
 * Updates user check-ins and achievements if applicable.
 * @param user - The user document
 * @param clientId - The ID of the client/location
 * @returns The earned achievement key if any, otherwise null
 */
export async function updateCheckinAchievements(
  user: IUser,
  clientId: string
): Promise<{ achievementKey: string | null; checkinCount: number }> {

  if (!user || !clientId) {
    throw new Error("Invalid parameters passed to updateCheckinAchievements.");
  }

  const clientIdString = clientId.toString();
  let clientStats = user.stats.get(clientIdString);

  const now = new Date();
  const nowInLA = DateTime.fromJSDate(now).setZone(LA_TIMEZONE);
  const todayStartInLA = nowInLA.startOf("day");
  const todayEndInLA = nowInLA.endOf("day");

  if (clientStats) {
    const alreadyCheckedInToday = clientStats.checkins?.some((checkin) => {
      if (!checkin) return false;
      const checkinDate = DateTime.fromJSDate(checkin).setZone(LA_TIMEZONE);
      return checkinDate >= todayStartInLA && checkinDate <= todayEndInLA;
    });

    if (alreadyCheckedInToday) {
      return {
        achievementKey: null,
        checkinCount: clientStats.checkins?.length ?? 0,
      };
    }
  } else {
    clientStats = {
      checkins: [],
      wins: 0,
      losses: 0,
      winStreak: 0,
      matches: [],
      pointsWon: 0,
      achievements: new Map(),
      rewards: new Map(),
    };
    user.stats.set(clientIdString, clientStats);

    clientStats = user.stats.get(clientIdString)!;
  }

  // Add today's check-in
  clientStats.checkins?.push(now);

  const totalCheckins = clientStats.checkins?.length ?? 1;

  let earnedAchievementKey: string | null = null;

  for (const milestone of CHECKIN_MILESTONES) {
    if (totalCheckins === milestone) {
      const achievementsMap = clientStats.achievements;
      const achievementKey = `checkin_${milestone}`;

      if (!achievementsMap.has(achievementKey)) {
        achievementsMap.set(achievementKey, {
          earnedAt: [now],
        });
        earnedAchievementKey = achievementKey;
      }
      break;
    }
  }

  try {
    await user.save();
  } catch (error) {
    console.error("Failed to save user with updated achievements:", error);
    throw new Error("Failed to save user with updated achievements.");
  }

  return {
    achievementKey: earnedAchievementKey,
    checkinCount: totalCheckins,
  };
}
