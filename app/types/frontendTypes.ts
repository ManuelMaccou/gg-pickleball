import { Types } from "mongoose";
import { IMatch } from "./databaseTypes";

export interface FrontendClientStats {
  visits?: Date[];
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
    _id: string;
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

type PopulatedPlayer = { _id: string; name: string };

export type PopulatedMatch = Omit<IMatch, "team1" | "team2"> & {
  team1: { players: PopulatedPlayer[]; score: number };
  team2: { players: PopulatedPlayer[]; score: number };
  winners: { _id: string }[]; 
  createdAt: Date;
};
