import { IClient } from "@/app/types/databaseTypes";

export const isClientSelectable = (client: IClient): boolean => {
  return !!(
    client.active &&
    Array.isArray(client.achievements) &&
    client.achievements.length > 0 &&
    client.rewardsPerAchievement &&
    Object.keys(client.rewardsPerAchievement).length > 0
  );
};