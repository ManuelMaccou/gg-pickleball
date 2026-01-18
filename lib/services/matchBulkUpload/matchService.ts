import Match from '@/app/models/Match';
import { ClientSession, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

type RequiredDbOptions = { session: ClientSession };

interface MatchCreationData {
  dataSourceId?: string | null;
  duprMatchId?: number;
  duprGameNumber?: number;
  eventName?: string;
  matchDate: Date;
  location?: string | null;
  team1Ids: string[]; team1Score: number;
  team2Ids: string[]; team2Score: number;
  winners: string[];
  isGlobalContext: boolean | undefined;
}
export async function createMatch(data: MatchCreationData & { 
  processedUsers: string[], team1Names?: string[], team2Names?: string[] 
}, dbOptions: RequiredDbOptions) {
  const cleanIds = (ids: (string | null)[]) => ids.filter(id => id && Types.ObjectId.isValid(id));
  
  const createdMatches = await Match.create(
    [{
      matchId: uuidv4(),
      dataSourceId: data.dataSourceId,
      matchDate: data.matchDate,
      duprMatchId: data.duprMatchId,
      duprGameNumber: data.duprGameNumber,
      duprEvent: data.eventName,
      location: data.location,
      team1: { 
          players: cleanIds(data.team1Ids), 
          playerNames: data.team1Names || [],
          score: data.team1Score 
      },
      team2: { 
          players: cleanIds(data.team2Ids), 
          playerNames: data.team2Names || [],
          score: data.team2Score 
      },
      winners: cleanIds(data.winners),
      processedUsers: data.processedUsers,
    }], 
    { session: dbOptions.session }
  );

  if (!createdMatches || createdMatches.length === 0) {
    throw new Error('Match creation failed within the transaction.');
  }

  // 3. Return the single created document, not the array
  return createdMatches[0];
}