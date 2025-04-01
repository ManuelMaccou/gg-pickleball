import { io } from "socket.io-client";
import type { GguprSocket, SaveMatchData, ScoreUpdateData } from './types/socketTypes';

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
    console.log("Attempting to connect to socket server...");

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, { 
      path: '/socket.io',
      transports: ['websocket'],
    });

    socket.on("connect", () => {
      const currentPlayer = players.find(player => player.userName === userName);

      console.log("Players passed to initiateSocketConnection:", currentPlayers);
      console.log("Current Player:", currentPlayer);

      console.log(`Connected to socket server with ID: ${socket?.id}`);

      if (currentPlayer) {
        socket?.emit("join-match", { matchId, userName, userId: currentPlayer.userId });
      } else {
        console.error("Current player not found in the player list.");
      }

      socket?.on("save-match", (data: SaveMatchData) => {
        console.log("📥 Received 'save-match' event from server:", data);
        handleSaveMatch(data, currentPlayers);
      });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server.");
    });
  } else {
    console.log('Socket already connected:', socket.id);
  }
};

export const handleSaveMatch = async (data: SaveMatchData, players: Player[]) => {
  console.log("📥 Received 'save-match' event from server:", data);
  console.log("📍 Location received:", data.location);
  if (data.success) {
    console.log("✅ Scores validated successfully. Triggering save to database.");
    try {
      console.log("📝 Sending POST request to /api/ggupr/match...");

      const getPlayerIds = (playerNames: string[]) => {
        return players
          .filter(player => playerNames.includes(player.userName))
          .map(player => player.userId);
      };

      const team1Ids = getPlayerIds(data.team1);
      const team2Ids = getPlayerIds(data.team2);

      const response = await fetch('/api/ggupr/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.matchId,
          team1: { players: team1Ids, score: data.team1Score },
          team2: { players: team2Ids, score: data.team2Score },
          winners: data.team1Score > data.team2Score ? team1Ids : team2Ids,
          location: data.location,
        }),
      });

      const result = await response.json();
      console.log("📬 Received response from /api/ggupr/match:", result);
      console.log("📬 Data received from /api/ggupr/match:", data);

      if (response.ok) {
        console.log("Match successfully saved to database!", result);
        socket?.emit("match-saved", { matchId: data.matchId });
        
        socket?.emit("clear-scores", { matchId: data.matchId });
        console.log(`Requested score clearance for match: ${data.matchId}`);
      } else {
        console.error("Failed to save match:", result.error);
      }
    } catch (error) {
      console.error("Error saving match to database:", error);
    }
  }
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    cleanupSocketListeners();
  }
};

const cleanupSocketListeners = () => {
  if (socket) {
    socket.off("player-list");
    socket.off("scores-validated");
    socket.off("teams-set");
    socket.off("score-update");
    socket.off("save-match");
  }
};

export const subscribeToPlayerJoined = (callback: (players: Player[]) => void) => {
  if (!socket) return;
  socket.off("player-list");
  socket.on("player-list", (updatedPlayers: Player[]) => {  // Always expect an array of Player objects
    console.log("Updated player list received from backend:", updatedPlayers);
    callback(updatedPlayers);  // Properly passing updated players to the callback
  });
};

export const subscribeToScoreUpdate = (callback: (data: ScoreUpdateData) => void) => {
  if (!socket) return;
  socket.off("score-update");
  socket.on("score-update", (data) => callback(data));
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

export const subscribeToMatchSaved = (callback: (data: { success: boolean; message: string }) => void) => {
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
