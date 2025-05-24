import { Types } from "mongoose";

export interface RewardCodeTask {
  rewardId: Types.ObjectId;
  userId: Types.ObjectId;
  clientId: Types.ObjectId;
}

export interface IRewardCodeEntry {
  _id: string;
  code: string;
  redeemed: boolean;
  redemptionDate?: Date;
  earnedAt: Date;
  rewardId: string;
}

export interface IRewardWithCode {
  _id: Types.ObjectId;
  name: string;
  friendlyName: string;
  product: "open play" | "reservation" | "shop gear";
  discount: number;
  type: "dollar" | "percent";
  category: "retail" | "programming";
  codes?: IRewardCodeEntry[];
}
