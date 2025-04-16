import { Types, Document } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  wins?: number;
  losses?: number;
  winStreak?: number;
  matches?: IMatch[];
  pointsWon?: number;
  achievements: {
    [key: string]: {
      count?: number; 
      earnedAt: Date[];
    };
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
  location: string
}


export interface IAchievement extends Document {
  _id: Types.ObjectId;
  friendlyName: string;
  name: string;
  badge: string;
}


export interface IReward extends Document {
  _id: Types.ObjectId;
  discount: string;
  product: string;
  name: string;
  achievement: string;
}