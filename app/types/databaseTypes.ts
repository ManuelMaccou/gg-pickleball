import { Types } from "mongoose";

export interface IUserAvailability {
  day: string; // Monday
  date: string; // YYYY-MM-DD format
  time: string; // 1:30-2pm
}

export interface IUser {
  _id?: string;
  auth0Id?: string;
  firstTimeInvite?: boolean;
  name?: string;
  email: string;
  profilePicture?: string;
  duprUrl?: string;
  dupr?: number;
  skillLevel?: "Beginner" | "Intermediate" | "Advanced";
  availability?: IUserAvailability[];
  wins?: number;
  losses?: number;
  activeSeasons?: ISeason[];
}

export interface ITeam {
  _id?: string;
  teammates: IUser[];
  captain: Types.ObjectId | string;
  preferredCourt?: Types.ObjectId | string;
  wins?: number;
  losses?: number;
  seasonId: Types.ObjectId | string;
  regionId: Types.ObjectId | string;
  registrationStep?: string,
  status?: string;
  individual? : boolean;
}

export interface IMatch {
  _id?: string;
  teams: Types.ObjectId[] | string[];
  challenger?: Types.ObjectId | string;
  status?: "initiated" | "paid" | "completed" | "canceled";
  winner?: {
    team: Types.ObjectId | string;
    score: number;
  };
  loser?: {
    team: Types.ObjectId | string;
    score: number;
  };
  seasonId: Types.ObjectId | string;
}

export interface ISeason {
  _id?: string;
  season: number;
  startDate: string;
  active: boolean;
}

export interface IConversation {
  _id?: string;
  seasonId: Types.ObjectId | string;
  users: Types.ObjectId[] | string[];
}

export interface TimeSlot {
  start: string; // e.g., "12:30"
  end: string;   // e.g., "13:00"
}

export interface AvailableHour {
  facility_schedule_id: number;
  schedule: TimeSlot;
  available: boolean;
}

export interface IAvailability {
  day: string; // Monday
  date: string; // YYYY-MM-DD format
  time: string; // 1:30-2pm
  available: boolean;
}

export interface ICourt {
  name: string;
  address: string;
  regionId: Types.ObjectId | string;
  availability: IAvailability[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRegion {
  _id?: string;
  name: string;
}

export interface IImage {
  contentType: string;
  data: Buffer;
}