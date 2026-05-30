import { DuprMatch, DuprMember } from "@/app/types/duprTypes";

export interface TransformedDuprMatch {
  duprMatchId: number;
  matchDate: Date;
  gameNumber: number; 
  isLastGame: boolean;  // add this
  players: { name: string; email: string; duprId: string }[];
  team1_score: number;
  team2_score: number;
  winners: { name: string; email: string; duprId: string }[];
  matchWinners: { name: string; email: string; duprId: string }[];  // add this
  eventName: string;
}

export interface SkippedMatchInfo {
  duprMatchId: number;
  playerName: string;
  duprId: string;
  reason: string;
}

export interface TransformedPersonalMatch {
  duprMatchId: number;
  matchDate: Date;
  gameNumber: number; 
  eventName: string;
  isLastGame: boolean;
  team1: {
      player1: { name: string; duprId: string };
      player2: { name: string; duprId: string };
      score: number;
      isMatchWinner: boolean; 
  };
  team2: {
      player1: { name: string; duprId: string };
      player2: { name: string; duprId: string };
      score: number;
      isMatchWinner: boolean;
  };
}

export function transformAndEnrichDuprMatches(
  duprMatches: DuprMatch[],
  duprMembers: DuprMember[]
): { validMatches: TransformedDuprMatch[], skippedRecords: SkippedMatchInfo[] } {
  
  const emailMap = new Map<string, string>();
  for (const member of duprMembers) {
    if (member.duprId && member.email) {
      emailMap.set(member.duprId.trim(), member.email);
    }
  }

  const validMatches: TransformedDuprMatch[] = [];
  const skippedRecords: SkippedMatchInfo[] = [];

  for (const match of duprMatches) {
    const team1 = match.teams.find(t => t.serial === 1);
    const team2 = match.teams.find(t => t.serial === 2);

    if (!team1 || !team2) continue; 

    const matchDate = match.eventDate ? new Date(match.eventDate) : new Date();
    const eventName = match.eventName;

    // Collect valid game numbers to identify the last one
    const validGameNumbers: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const gameKey = `game${i}` as keyof typeof team1;
      const score1 = team1[gameKey];
      const score2 = team2[gameKey];
      if (typeof score1 === 'number' && typeof score2 === 'number' && score1 >= 0 && score2 >= 0) {
        validGameNumbers.push(i);
      }
    }

    const lastGameNumber = validGameNumbers.length > 0 
      ? validGameNumbers[validGameNumbers.length - 1] 
      : 0;

    for (const gameNum of validGameNumbers) {
      const gameKey = `game${gameNum}` as keyof typeof team1;
      const score1 = team1[gameKey] as number;
      const score2 = team2[gameKey] as number;

      const allPlayersInGame = [team1.player1, team1.player2, team2.player1, team2.player2];
      const enrichedPlayers = [];
      let gameFailed = false;

      for (const player of allPlayersInGame) {
          const duprIdToFind = player.duprId?.trim();
          
          if (!duprIdToFind) {
              skippedRecords.push({
                  duprMatchId: match.id,
                  playerName: player.fullName,
                  duprId: 'UNKNOWN',
                  reason: 'Player has no DUPR ID in match data'
              });
              gameFailed = true;
              continue;
          }

          const email = emailMap.get(duprIdToFind);
          if (!email) {
              skippedRecords.push({
                  duprMatchId: match.id,
                  playerName: player.fullName,
                  duprId: duprIdToFind,
                  reason: 'Email not found in Club Member Directory'
              });
              gameFailed = true;
              continue;
          }

          enrichedPlayers.push({ name: player.fullName, email, duprId: duprIdToFind });
      }

      if (gameFailed) {
          continue;
      }

      const players = enrichedPlayers as { name: string; email: string; duprId: string }[];
      // Game-level winners (by score)
      const winners = (score1 > score2 ? [players[0], players[1]] : [players[2], players[3]]);
      // Match-level winners (from DUPR's winner field)
      const matchWinners = team1.winner === true ? [players[0], players[1]] : [players[2], players[3]];

      validMatches.push({
        matchDate: matchDate,
        duprMatchId: match.id,
        gameNumber: gameNum,
        isLastGame: gameNum === lastGameNumber,
        players,
        team1_score: score1,
        team2_score: score2,
        winners,
        matchWinners,
        eventName
      });
    }
  }
  
  return { validMatches, skippedRecords };
}

export function transformPersonalDuprMatches(duprMatches: DuprMatch[]): TransformedPersonalMatch[] {
  const transformed: TransformedPersonalMatch[] = [];

  for (const match of duprMatches) {
    const team1Data = match.teams.find(t => t.serial === 1);
    const team2Data = match.teams.find(t => t.serial === 2);

    if (!team1Data || !team2Data) continue; 

    const matchDate = match.eventDate ? new Date(match.eventDate) : new Date();

    // Collect all valid game numbers first to identify the last one
    const validGameNumbers: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const gameKey = `game${i}` as keyof typeof team1Data;
      const score1 = team1Data[gameKey];
      const score2 = team2Data[gameKey];
      if (typeof score1 === 'number' && typeof score2 === 'number' && score1 >= 0 && score2 >= 0) {
        validGameNumbers.push(i);
      }
    }

    const lastGameNumber = validGameNumbers.length > 0 
      ? validGameNumbers[validGameNumbers.length - 1] 
      : 0;

    for (const gameNum of validGameNumbers) {
      const gameKey = `game${gameNum}` as keyof typeof team1Data;
      const score1 = team1Data[gameKey] as number;
      const score2 = team2Data[gameKey] as number;

      transformed.push({
        duprMatchId: match.id,
        matchDate: matchDate,
        gameNumber: gameNum,
        eventName: match.eventName || match.league,
        isLastGame: gameNum === lastGameNumber,
        team1: {
            player1: { name: team1Data.player1.fullName, duprId: team1Data.player1.duprId },
            player2: { name: team1Data.player2.fullName, duprId: team1Data.player2.duprId },
            score: score1,
            isMatchWinner: team1Data.winner === true,
        },
        team2: {
            player1: { name: team2Data.player1.fullName, duprId: team2Data.player1.duprId },
            player2: { name: team2Data.player2.fullName, duprId: team2Data.player2.duprId },
            score: score2,
            isMatchWinner: team2Data.winner === true,
        }
      });
    }
  }
  return transformed;
}