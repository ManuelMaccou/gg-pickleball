import { Types } from "mongoose";
import { IReward } from "./databaseTypes";

export const REWARD_PRODUCT_NAMES = ["open play", "reservations", "guest reservations", "classes and clinics", "pro shop", 'custom'] as const;
export type RewardProductName = typeof REWARD_PRODUCT_NAMES[number];

export const REWARD_CATEGORY_NAMES = ["retail", "programming", "custom"] as const;
export type RewardCategoryName = typeof REWARD_CATEGORY_NAMES[number];

export interface RewardCodeTask {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  clientId: Types.ObjectId;
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
