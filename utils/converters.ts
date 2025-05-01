import { IUser } from "@/app/types/databaseTypes";
import { FrontendClientStats, FrontendUser } from "@/app/types/frontendTypes";

export function toFrontendUser(user: IUser): FrontendUser {
  return {
    _id: user._id.toString(), // Convert ObjectId -> string
    name: user.name,
    auth0Id: user.auth0Id,
    email: user.email,
    profilePicture: user.profilePicture,
    lastLocation: user.lastLocation?.toString(), // Optional
    stats: mapStats(user.stats),
  };
}

export function mapStats(stats: any): Record<string, FrontendClientStats> {
  const plainStats: Record<string, FrontendClientStats> = {};

  if (stats instanceof Map) {
    stats.forEach((value, key) => {
      plainStats[key] = {
        ...value,
        achievements: Object.fromEntries(
          value.achievements instanceof Map ? value.achievements : new Map()
        ),
        rewards: Object.fromEntries(
          value.rewards instanceof Map ? value.rewards : new Map()
        ),
      };
    });
  } else if (typeof stats === 'object' && stats !== null) {
    Object.entries(stats).forEach(([key, value]) => {
      const val = value as Partial<FrontendClientStats>;

      plainStats[key] = {
        ...val,
        achievements: Object.fromEntries(Object.entries(val.achievements ?? {})),
        rewards: Object.fromEntries(Object.entries(val.rewards ?? {})),
      };
    });
  }

  return plainStats;
}


