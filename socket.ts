import { io } from "socket.io-client";
import { GguprSocket, SaveMatchData } from "./app/types/socketTypes";
import { updateUserAndAchievements } from "./utils/achievementFunctions/updateUserAndAchievements";
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

      socket?.on("save-match", (data: SaveMatchData) => {
        handleSaveMatch(data, currentPlayers);
      });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server.");
    });
  }
};

export const handleSaveMatch = async (data: SaveMatchData, players: Player[]) => {
  if (!data.success) return

  let earnedAchievements: { userId: string; achievements: SerializedAchievement[] }[] = [];
  let matchResponse: Response | undefined;

  try {
    const getPlayerIds = (playerNames: string[]) => {
      return players
        .filter(player => playerNames.includes(player.userName))
        .map(player => player.userId);
    };

    const team1Ids = getPlayerIds(data.team1);
    const team2Ids = getPlayerIds(data.team2);
    const winners = data.team1Score > data.team2Score ? team1Ids : team2Ids;
    const location = data.location;
    const team1Score = data.team1Score;
    const team2Score = data.team2Score;

    // Save match
    matchResponse = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: data.matchId,
        team1: { players: team1Ids, score: team1Score },
        team2: { players: team2Ids, score: team2Score },
        winners,
        location
      }),
    });

    let result: any;
    try {
      result = await matchResponse.json();
    } catch (jsonError) {
      const rawText = await matchResponse.text();
      console.error("❌ Failed to parse match response as JSON:", rawText);

      socket?.emit("match-saved", {
        success: false,
        message: "Server error: invalid response format. We've received the error and are fixing it.",
        matchId: "",
        earnedAchievements: []
      });
      return;
    }

    if (!matchResponse.ok || !result?.match?._id) {
      const errorMessage = result?.error || "A server error occurred while saving the match. We're investigating the issue.";
      console.error("❌ Match save failed:", errorMessage);

      socket?.emit("match-saved", {
        success: false,
        message: errorMessage,
        matchId: "",
        earnedAchievements: []
      });
      return;
    }

    const newMatchId = result?.match._id

      // Update users and their achievements
    try {
      const achievementsResult = await updateUserAndAchievements(
        team1Ids,
        team2Ids,
        winners,
        location,
        newMatchId,
        team1Score,
        team2Score
      );

      earnedAchievements = achievementsResult.earnedAchievements || [];
    
    } catch (error) {
      console.error('❌ Failed to update achievements after match:', error);

      socket?.emit("match-saved", {
        success: false,
        message: "Match saved, but failed to update achievements. We're investigating the issue.",
        matchId: "",
        earnedAchievements: []
      });
      return;
    }

    socket?.emit("match-saved", {
      success: true,
      message: "Match successfully saved!",
      matchId: data.matchId,
      earnedAchievements
    });

    socket?.emit("clear-scores", { matchId: data.matchId });
    
  } catch (error) {
    console.error("❌ Failed to handle match saving:", error);
  
    let message = "Unexpected error while saving the match.";

    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
  
    if (matchResponse) {
      try {
        const errorText = await matchResponse.text();
        console.error("💬 Raw response body:", errorText);
        message += ` — ${errorText}`;
      } catch (parseError) {
        console.error("❌ Failed to parse raw error response body:", parseError);
      }
      socket?.emit("match-saved", {
        success: false,
        message,
        matchId: "",
        earnedAchievements: []
      });
    }
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

export const subscribeToSaveMatch = (callback: (data: SaveMatchData) => void) => {
  if (!socket) return;
  socket.off("save-match");
  socket.on("save-match", (data) => callback(data));
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
