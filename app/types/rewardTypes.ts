import { Types } from "mongoose";
import { IClient, IReward, IRewardCode } from "./databaseTypes";

export const REWARD_PRODUCT_NAMES = ["open play", "reservations", "guest reservations", "classes and clinics", "pro shop", 'online store', 'in store', 'custom'] as const;
export type RewardProductName = typeof REWARD_PRODUCT_NAMES[number];

export const REWARD_CATEGORY_NAMES = ["retail", "programming", "custom"] as const;
export type RewardCategoryName = typeof REWARD_CATEGORY_NAMES[number];

export interface RewardCodeTask {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  clientId: Types.ObjectId;
  isGlobalReward?: boolean;
  dataSourceId?: Types.ObjectId;
}

export interface IRewardCodeEntry {
  _id: string;
  code: string;
  redeemed: boolean;
  redemptionDate?: Date;
  earnedAt: Date;
}

export interface IRewardWithCode {
  _id: Types.ObjectId;
  index: number;
  repeatable?: boolean;
  name: string;
  friendlyName: string;
  product: RewardProductName
  productDescription?: string;
  discount?: number;
  minimumSpend?: number;
  maxDiscount?: number;
  type?: "dollars" | "percent";
  category: RewardCategoryName;
  codes?: IRewardCodeEntry[];
}

export interface GlobalConfiguredReward {
  achievement: {
    _id: string;
    name: string;
    friendlyName: string;
    task: string
  };
  reward: IRewardWithCode;
  sponsoringClient: IClient;
};

// The main data structure for displaying a reward in the grid
export type RewardWithContext = IRewardWithCode & {
  achievementId: string;
  achievementFriendlyName: string;
  achievementTask: string;
  sponsoringClient: IClient;
  codes: {
    _id: string;
    code: string;
    redeemed: boolean;
    earnedAt: Date;
    redemptionDate?: Date;
  }[];
};

// Represents an earned global reward code, with populated achievement data
export type PopulatedGlobalRewardCode = Omit<IRewardCode, 'rewardId' | 'achievementId'> & {
  // The API populates achievementId into an object
  achievementId: { _id: string; friendlyName: string; task: string, name: string };
  // The API populates clientId into a full IClient object
  clientId: IClient; 
};
