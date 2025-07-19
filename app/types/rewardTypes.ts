import { Types } from "mongoose";
import { IReward } from "./databaseTypes";

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
  name: string;
  friendlyName: string;
  product: "open play" | "reservation" | "pro shop";
  discount: number;
  minimumSpend?: number;
  maxDiscount?: number;
  type: "dollars" | "percent";
  category: "retail" | "programming";
  codes?: IRewardCodeEntry[];
}
