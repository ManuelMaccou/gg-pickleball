import { io } from "socket.io-client";
import { GguprSocket } from "./app/types/socketTypes";
import { SerializedAchievement } from "./app/types/databaseTypes";

let socket: GguprSocket | null = null;

type Player = {
  userName: string;
  userId: string;
  socketId: string;
};

let players: Player[] = [];

export const initiateSocketConnection = (matchId: string, userName: string, currentPlayers: Player[]) => {
  players = currentPlayers; 

  if (!socket || socket.disconnected) {  // Ensure socket isn't recreated unnecessarily

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, { 
      path: '/socket.io',
      transports: ['websocket']
    });

    socket.on("connect", () => {
      const currentPlayer = players.find(player => player.userName === userName);

      if (currentPlayer) {
        socket?.emit("join-match", { matchId, userName, userId: currentPlayer.userId });
      } else {
        console.error("Current player not found in the player list.");
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server.");
    });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    cleanupSocketListeners();
  }
};

const cleanupSocketListeners = () => {
  if (socket) {
    socket.off("player-list");
    socket.off("scores-validated");
    socket.off("teams-set");
    socket.off("save-match");
    socket.off("match-saved");
  }
};

export const subscribeToPlayerJoined = (callback: (players: Player[]) => void) => {
  if (!socket) return;
  socket.off("player-list");
  socket.on("player-list", (updatedPlayers: Player[]) => {  // Always expect an array of Player objects
    callback(updatedPlayers);  // Properly passing updated players to the callback
  });
};

export const subscribeToScoreValidation = (callback: (data: { success: boolean; message?: string }) => void) => {
  if (!socket) return;
  socket.off("scores-validated");
  socket.on("scores-validated", (data) => {
    callback(data);
  });
};

// --- NEW FUNCTION TO TRIGGER THE SAVE ON THE SERVER ---
export const requestSaveMatch = (matchId: string) => {
  if (socket) {
    console.log(`🚀 Client requesting server to save match: ${matchId}`);
    socket.emit("client-requests-save-match", { matchId });
  }
};

// NEW: Add a subscription function for the intermediate success event
export const subscribeToMatchSaveSuccessful = (callback: (data: {
  team1Ids: string[];
  team2Ids: string[];
  winners: string[];
  location: any; // Use your specific type
  newMatchId: string;
  team1Score: number;
  team2Score: number;
}) => void) => {
  if (!socket) return;
  socket.off("match-save-successful");
  socket.on("match-save-successful", (data) => callback(data));
};

// A private message for ONLY the winner of the race.
export const subscribeToPermissionGranted = (callback: (data: any) => void) => {
  socket?.off("permission-granted-for-update").on("permission-granted-for-update", callback);
};

export const claimAchievementUpdateTask = (matchId: string, data: any) => {
  if (socket) {
    socket.emit("claim-achievement-update-task", { matchId, data });
  }
};

// NEW: Add an emitter for when the client is done
export const notifyUpdatesFinished = (
    matchId: string, 
    result: { earnedAchievements?: any[], error?: Error }
) => {
  if (socket) {
    socket.emit("client-finished-updates", {
      matchId,
      earnedAchievements: result.earnedAchievements,
      errorMessage: result.error?.message
    });
  }
};

export const subscribeToMatchSaved = (callback: (data: { 
  success: boolean;
  matchId: string;
  message: string;
  earnedAchievements: { userId: string; achievements: SerializedAchievement[] }[];
}) => void) => {
  if (!socket) return;
  socket.off("match-saved");
  socket.on("match-saved", (data) => callback(data));
};

export const clearScores = (matchId: string) => {
  if (socket) {
    socket.emit("clear-scores", { matchId });
  }
};

export const getSocket = () => socket;

export default socket;
