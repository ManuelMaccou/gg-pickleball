import { Types } from "mongoose";

export interface DuprMember {
  id: number;
  fullName: string;
  duprId: string;
  email: string;
}

export interface DuprPlayer {
  id: number;
  fullName: string;
  duprId: string;
  imageUrl: string | null;
  postMatchRating: {
    singles: number | null;
    doubles: number | null;
  };
}

export interface DuprTeam {
  id: number;
  game1: number;
  game2: number;
  game3: number;
  game4: number;
  game5: number;
  player1: DuprMember;
  player2: DuprMember;
  winner: boolean;
  serial: number;
}

export interface DuprMatch {
  id: number;
  matchId: number;
  eventDate: string; // Format: "YYYY-MM-DD"
  eventName: string;
  duprMatchId: number;
  duprGameNumber: number;
  processedUsers: Types.ObjectId[];
  venue: string;
  location: string;
  matchType: string; // e.g., "SIDE_ONLY"
  teams: DuprTeam[];
  confirmed: boolean;
  league: string;
  eventFormat: "DOUBLES" | "SINGLES";
}

export interface DuprMatchApiResponse {
  status: string;
  result: {
    offset: number;
    limit: number;
    total: number;
    hits: DuprMatch[];
    hasMore: boolean;
  };
}