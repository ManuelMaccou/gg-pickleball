import Match from '@/app/models/Match';
import { v4 as uuidv4 } from 'uuid';

interface MatchCreationData {
  location: string;
  team1Ids: string[]; team1Score: number;
  team2Ids: string[]; team2Score: number;
  winners: string[];
}

export async function createMatch(data: MatchCreationData) {
  const newMatch = await Match.create({
    matchId: uuidv4(),
    location: data.location,
    team1: { players: data.team1Ids, score: data.team1Score },
    team2: { players: data.team2Ids, score: data.team2Score },
    winners: data.winners,
  });
  return newMatch;
}