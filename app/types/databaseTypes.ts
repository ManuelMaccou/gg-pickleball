import { Types } from "mongoose";

export interface IUserAvailability {
  day: string; // Monday
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
  referrer?: string;
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
  teammatesPaid?: IUser[];
  stripePaymentIntent?: string[];
}

interface IScore {
  teamId: Types.ObjectId | string;
  score: number;
  submittingTeam: Types.ObjectId | string;
}

interface IScores {
  items: IScore[];
  confirmed: boolean;
}

export interface IMatch {
  _id?: string;
  day: string;
  date: string;
  time: string;
  location: Types.ObjectId | string;
  teams: Types.ObjectId[] | string[];
  challenger?: Types.ObjectId | string;
  status?: "PENDING" | "BOOKED" | "COMPLETED";
  scores?: IScores;
  winner?: {
    teamId: Types.ObjectId | string;
    score: number;
  };
  loser?: {
    teamId: Types.ObjectId | string;
    score: number;
  };
  seasonId: Types.ObjectId | string;
  regionId: Types.ObjectId | string;
  playersPaid?: IUser[];
  stripePaymentIntent?: string[];
}

export interface ISeason {
  _id?: string;
  season: number;
  startDate: string;
  active: boolean;
}

export interface IConversation {
  _id?: string;
  matchId: Types.ObjectId | string;
  users: Types.ObjectId[] | string[];
  messages?: {
    _id?: string;
    user?: Types.ObjectId | string;
    text: string;
    systemMessage?: boolean;
    createdAt?: string;
  }[];
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
  _id?: string;
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

export interface IGguprUser {
  _id?: string;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  wins?: number;
  losses?: number;
  matches?: IGguprMatch[];
}

export interface IGguprMatch {
  _id?: string;
  matchId?: number;
  team1: {
    players: Types.ObjectId[] | string[]; 
    score: number;
  };
  team2: {
    players: Types.ObjectId[] | string[];  // Mixed reference: ObjectId (if user exists) or raw string for guests
    score: number;
  };
  winners: Types.ObjectId[];
  location: string
}