import { Types, Document } from 'mongoose';

export const REWARD_PRODUCT_NAMES = ["open play", "reservations", "guest reservations", "classes and clinics", "pro shop", "custom"] as const;
export type RewardProductName = typeof REWARD_PRODUCT_NAMES[number];

export const REWARD_CATEGORY_NAMES = ["retail", "programming", "custom"] as const;
export type RewardCategoryName = typeof REWARD_CATEGORY_NAMES[number];

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
  lastVisit?: Date;
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  // matches?: Types.ObjectId[];
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
  superAdmin?: string;
  email?: string;
  dupr?: IDupr;
  profilePicture?: string;
  lastLocation?: Types.ObjectId;
  stats: Map<string,ClientStats>;
}

export type ResolvedUser = {
  id: string
  name: string
  email?: string
  isGuest: boolean
  superAdmin?: boolean
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
  categoryId: Types.ObjectId;
  friendlyName: string;
  name: string;
  badge: string;
}

export interface IAchievementCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  milestones?: string[];
}


export interface IReward extends Document {
  _id: Types.ObjectId;
  index: number;
  repeatable?: boolean;
  name: string;
  friendlyName: string;
  product: RewardProductName;
  productDescription?: string;
  discount?: number;
  minimumSpend?: number;
  maxDiscount?: number;
  type?: "dollars" | "percent";
  category: RewardCategoryName;
}

export interface ShopifyData {
  shopDomain: string;
  accessToken: string;
  secret: string;
}

export interface PodplayData {
  accessToken: string;
}

export interface PlayByPointData {
  facilityId: number | undefined;
  affiliations: string[];
}

export interface IClient extends Document {
  _id: Types.ObjectId;
  name: string;
  latitude: string;
  longitude: string;
  logo: string;
  rewardProducts: string[];
  admin_logo: string;
  bannerColor: string;
  icon: string;
  altAchievements?: Types.ObjectId[];
  altRewardsPerAchievement?: {
    [achievementId: string]: IReward;
  };
  achievements?: Types.ObjectId[];
  rewardsPerAchievement?: {
    [achievementId: string]: IReward;
  };
  retailSoftware: "shopify" | "playbypoint" | undefined;
  reservationSoftware: "playbypoint" | "podplay" | "courtreserve" | undefined;
  rewardConfigStatus?: "pending" | "active";
  shopify?: ShopifyData;
  playbypoint?: PlayByPointData;
  podplay?: PodplayData;
}

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  location: Types.ObjectId;
}

export interface IRewardCode {
  _id: Types.ObjectId;
  code: string;
  userId?: Types.ObjectId;
  clientId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  redeemed: boolean;
  redemptionDate?: Date;
  addedToPos?: boolean;
  createdAt: Date;
}