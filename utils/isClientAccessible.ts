import { IClient } from "@/app/types/databaseTypes";

const EXCLUDED_CLIENT_NAME = "Test Client";

export const isClientSelectable = (client: IClient): boolean => {
  return !!(
    client.name !== EXCLUDED_CLIENT_NAME &&
    client.active &&
    Array.isArray(client.achievements) &&
    client.achievements.length > 0 &&
    client.rewardsPerAchievement &&
    Object.keys(client.rewardsPerAchievement).length > 0
  );
};