import { DuprMatch, DuprMember } from "@/app/types/duprTypes";

export interface TransformedDuprMatch {
  duprMatchId: number;
  matchDate: Date;
  gameNumber: number; 
  players: { name: string; email: string; duprId: string }[];
  team1_score: number;
  team2_score: number;
  winners: { name: string; email: string; duprId: string }[];
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
  team1: {
      player1: { name: string; duprId: string };
      player2: { name: string; duprId: string };
      score: number;
  };
  team2: {
      player1: { name: string; duprId: string };
      player2: { name: string; duprId: string };
      score: number;
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

    for (let i = 1; i <= 5; i++) {
      const gameKey = `game${i}` as keyof typeof team1;
      const score1 = team1[gameKey];
      const score2 = team2[gameKey];

      if (typeof score1 === 'number' && typeof score2 === 'number' && score1 >= 0 && score2 >= 0) {
        
        const allPlayersInGame = [team1.player1, team1.player2, team2.player1, team2.player2];
        const enrichedPlayers = [];
        let gameFailed = false;

        for (const player of allPlayersInGame) {
            const duprIdToFind = player.duprId?.trim();
            
            // 1. Check if DUPR ID exists
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

            // 2. Check if Email Exists in Club Roster
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
            continue; // Skip this game, but capture the errors above
        }

        const players = enrichedPlayers as { name: string; email: string; duprId: string }[];
        const winners = (score1 > score2 ? [players[0], players[1]] : [players[2], players[3]]);

        validMatches.push({
          matchDate: matchDate,
          duprMatchId: match.id,
          gameNumber: i,
          players,
          team1_score: score1,
          team2_score: score2,
          winners,
          eventName
        });
      }
    }
  }
  
  return { validMatches, skippedRecords };
}

export function transformPersonalDuprMatches(duprMatches: DuprMatch[]): TransformedPersonalMatch[] {
  const transformed: TransformedPersonalMatch[] = [];

  console.log('starting transformPersonalDuprMatches')
  console.log('matches:', duprMatches)

  for (const match of duprMatches) {
    const team1Data = match.teams.find(t => t.serial === 1);
    const team2Data = match.teams.find(t => t.serial === 2);

    console.log('team1 data:', team1Data)

    if (!team1Data || !team2Data) continue; 

    const matchDate = match.eventDate ? new Date(match.eventDate) : new Date();

    // Loop through games 1-5
    for (let i = 1; i <= 5; i++) {
      const gameKey = `game${i}` as keyof typeof team1Data;
      const score1 = team1Data[gameKey];
      const score2 = team2Data[gameKey];

      // Check if game was played (score >= 0)
      if (typeof score1 === 'number' && typeof score2 === 'number' && score1 >= 0 && score2 >= 0) {
        
        transformed.push({
          duprMatchId: match.id,
          matchDate: matchDate,
          gameNumber: i,
          eventName: match.eventName || match.league,
          team1: {
              player1: { name: team1Data.player1.fullName, duprId: team1Data.player1.duprId },
              player2: { name: team1Data.player2.fullName, duprId: team1Data.player2.duprId },
              score: score1
          },
          team2: {
              player1: { name: team2Data.player1.fullName, duprId: team2Data.player1.duprId },
              player2: { name: team2Data.player2.fullName, duprId: team2Data.player2.duprId },
              score: score2
          }
        });
      }
    }
  }
  return transformed;
}