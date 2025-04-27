import { Types, Document } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  lastLocation?: Types.ObjectId;
  stats: {
    [clientId: string]: {
      wins?: number;
      losses?: number;
      winStreak?: number;
      matches?: IMatch[];
      pointsWon?: number;
      achievements: {
        [achievementName: string]: {
          count?: number
          earnedAt: Date[]
        }
      }
      rewards: {
        [rewardName: string]: {
          redeemed: boolean
          redemptionDate?: Date
        }
      }
    }
  }
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
  logo: string;
  achievements?: Types.ObjectId[];
  rewardsPerAchievement?: {
    [achievementId: string]: Types.ObjectId;
  };
}