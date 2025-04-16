import { Socket } from "socket.io-client";

// Define all the events your socket is handling

export interface ClientToServerEvents {
  "join-match": (data: { matchId: string; userName: string, userId: string }) => void;
  "set-teams": (data: { matchId: string; team1: string[]; team2: string[] }) => void;
  "submit-score": (data: { 
    matchId: string; 
    userName: string; 
    team1: string[]; 
    team2: string[]; 
    yourScore: number | null; 
    opponentsScore: number | null; 
    location: string;
  }) => void;
  "save-match": (data: { 
    matchId: string; 
    team1: string[]; 
    team2: string[]; 
    team1Score: number; 
    team2Score: number; 
    winners: string[]; 
    location: string;
  }) => void;
  "match-saved": (data: { matchId: string }) => void;
  "clear-scores": (data: { matchId: string }) => void;
}

export interface ServerToClientEvents {
  "player-list": (players: { userName: string; socketId: string, userId: string, }[]) => void;
  "scores-validated": (data: { success: boolean; message?: string }) => void;
  "teams-set": (data: { team1: string[]; team2: string[] }) => void;
  "save-match": (data: SaveMatchData) => void;
  "match-saved": (data: { success: boolean; message: string }) => void;
  "room-expired": (data: { matchId: string }) => void;
}

export interface SaveMatchData {
  success: boolean;
  matchId: string;
  team1: string[];
  team2: string[];
  team1Score: number;
  team2Score: number;
  location: string;
}

// Define your socket type
export type GguprSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
