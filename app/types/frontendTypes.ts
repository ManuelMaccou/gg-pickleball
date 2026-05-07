import { Types } from "mongoose";
import { IClient, IDataSource, IDupr, IMatch } from "./databaseTypes";

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
  dupr?: IDupr;
  profilePicture?: string;
  lastLocation?: string;
  stats: Record<string, FrontendClientStats>;
  accountClaimed?: boolean;
}

type PopulatedPlayer = { _id: string; name: string };

export type PopulatedMatch = Omit<IMatch, "team1" | "team2"> & {
  team1: { players: PopulatedPlayer[]; score: number; playerNames: string[]; };
  team2: { players: PopulatedPlayer[]; score: number; playerNames: string[]; };
  winners: { _id: string }[]; 
  createdAt: Date;
};

export interface BasePopulatedDoc {
  _id: string;
  name: string;
  friendlyName: string;
  product: string;
  index?: number;
  [key: string]: unknown;
}

export type SelectableItem = {
  _id: string;
  name: string;
  displayIcon: string;
  type: 'client' | 'dataSource';
  originalData: IClient | IDataSource;
};