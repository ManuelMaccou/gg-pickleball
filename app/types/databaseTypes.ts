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
  rewardCodeId?: Types.ObjectId;
}

export interface ClientStats {
  visits?: Date[];
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: Types.ObjectId[];
  achievements: AchievementData[];
  rewards: RewardData[];
}

export interface IDupr {
  duprId: string;
  email: string;
  activated: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  auth0Id?: string;
  email?: string;
  dupr?: IDupr;
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
  logToDupr: boolean;
}

export type SerializedAchievement = {
  _id: string;
  index: number;
  name: string;
  friendlyName: string;
  badge: string;
};

export interface IAchievement extends Document {
  _id: Types.ObjectId;
  index: number;
  friendlyName: string;
  name: string;
  badge: string;
}


export interface IReward extends Document {
  _id: Types.ObjectId;
  index: number;
  name: string;
  friendlyName: string;
  product: "open play" | "reservation" | "shop gear";
  discount: number;
  type: "dollar" | "percent";
  category: "retail" | "programming";
}

export interface ShopifyData {
  shopDomain: string;
  accessToken: string;
  secret: string;
}

export interface PodplayData {
  accessToken: string;
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
  retailSoftware: "shopify" | "playbypoint";
  reservationSoftware: "playbypoint" | "podplay" | "courtreserve";
  shopify?: ShopifyData;
  podplay?: PodplayData;
}

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  location: Types.ObjectId;
  bannerColor: string;
}

export interface IRewardCode {
  _id: Types.ObjectId;
  code: string;
  userId: Types.ObjectId;
  clientId: Types.ObjectId;
  rewardId: Types.ObjectId;
  redeemed: boolean;
  redemptionDate?: Date;
  createdAt: Date;
}