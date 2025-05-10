import { Types } from "mongoose";

export interface FrontendClientStats {
  checkins?: Date[];
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: string[]; // object ids are strings on frontend
  achievements: {
    achievementId: Types.ObjectId;
    name: string;
    earnedAt: Date;
    count?: number;
  }[];
  rewards: {
      rewardId: Types.ObjectId;
      earnedAt: Date;
      redeemed: boolean;
      redemptionDate?: Date;
      code?: string;
    }[];
}

export interface FrontendUser {
  _id: string;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  lastLocation?: string;
  stats: Record<string, FrontendClientStats>;
}
