import { Types, Document } from 'mongoose';

export interface AchievementEarned {
  key: string;
  repeatable: boolean;
};

export interface AchievementData {
  achievementId: Types.ObjectId;
  name: string;
  earnedAt: Date;
  count?: number;
}

export interface RewardData {
  rewardId: Types.ObjectId;
  earnedAt: Date;
  redeemed: boolean;
  redemptionDate?: Date;
  code?: string;
}

export interface ClientStats {
  checkins?: Date[];
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: Types.ObjectId[];
  achievements: AchievementData[];
  rewards: RewardData[];
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  lastLocation?: Types.ObjectId;
  stats: Map<string,ClientStats>;
}

export interface IMatch extends Document {
  _id: Types.ObjectId;
  matchId?: number;
  team1: {
    players: Types.ObjectId[]; 
    score: number;
  };
  team2: {
    players: Types.ObjectId[];
    score: number;
  };
  winners: Types.ObjectId[];
  location: Types.ObjectId;
}

export type SerializedAchievement = {
  _id: string;
  name: string;
  friendlyName: string;
  badge: string;
};

export interface IAchievement extends Document {
  _id: Types.ObjectId;
  friendlyName: string;
  name: string;
  badge: string;
}


export interface IReward extends Document {
  _id: Types.ObjectId;
  name: string;
  product: string;
  discount: string;
}

export interface IClient extends Document {
  _id: Types.ObjectId;
  name: string;
  latitude: string;
  longitude: string;
  logo: string;
  icon: string;
  achievements?: Types.ObjectId[];
  rewardsPerAchievement?: {
    [achievementId: string]: IReward;
  };
}

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  location: Types.ObjectId;
  bannerColor: string;
}