import { Socket } from "socket.io-client";
import { SerializedAchievement } from "./databaseTypes";

export interface AchievementUpdateData {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: string;
  newMatchId: string;
  team1Score: number;
  team2Score: number;
}

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
  "claim-achievement-update-task": (data: {
    matchId: string;
    data: AchievementUpdateData
  }) => void;
  "client-requests-save-match": (data: { matchId: string }) => void;
  "client-finished-updates": (data: {
    matchId: string;
    earnedAchievements?: {
      userId: string;
      achievements: SerializedAchievement[];
    }[];
    errorMessage?: string;
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
  "match-saved": (data: { 
    success: boolean;
    message: string;
    matchId: string;
    earnedAchievements: {
      userId: string;
      achievements: SerializedAchievement[];
    }[];
  }) => void;
  "clear-scores": (data: { matchId: string }) => void;
}

export interface ServerToClientEvents {
  "player-list": (players: { userName: string; socketId: string, userId: string, }[]) => void;
  "scores-validated": (data: { success: boolean; message?: string }) => void;
  "teams-set": (data: { team1: string[]; team2: string[] }) => void;
  "save-match": (data: SaveMatchData) => void;
  "match-saved": (data: {
    success: boolean;
    matchId: string;
    message: string;
    earnedAchievements: {
      userId: string;
      achievements: SerializedAchievement[];
    }[];
  }) => void;
  "room-expired": (data: { matchId: string }) => void;
  "match-save-successful": (data: {
    team1Ids: string[];
    team2Ids: string[];
    winners: string[];
    location: string;
    newMatchId: string;
    team1Score: number;
    team2Score: number;
  }) => void;
  "permission-granted-for-update": (data: AchievementUpdateData) => void;
}

export interface SaveMatchData {
  success: boolean;
  message: string
  matchId: string;
  team1: string[];
  team2: string[];
  team1Score: number;
  team2Score: number;
  location: string;
}

// Define your socket type
export type GgSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
