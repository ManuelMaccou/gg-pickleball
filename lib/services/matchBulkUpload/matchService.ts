// Destination: lib/services/matchBulkUpload/matchService.ts

import Match from '@/app/models/Match';
import { ClientSession, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

type RequiredDbOptions = { session: ClientSession };

interface MatchCreationData {
  duprMatchId?: number;
  duprGameNumber?: number;
  eventName?: string;
  matchDate: Date;
  location?: string | null;
  team1Ids: string[]; team1Score: number;
  team2Ids: string[]; team2Score: number;
  winners: string[];
  isGlobalContext: boolean | undefined;
  // [Program pivot] NEW — all optional individually, but required together
  // whenever `programId` is provided (validated below). Tied to `programId`
  // presence rather than checking dataSourceId's type against the DataSource
  // collection — cheaper (no extra query per call), and programId and these
  // program-specific fields should always travel together for a
  // program-sourced match anyway. Existing DUPR-sourced callers are
  // unaffected — none of this validation runs unless programId is passed.
  sourceMatchId?: string;
  matchType?: 'singles' | 'doubles';
  programId?: string;
  division?: string;
  // [Eligibility check] NEW — raw DUPR IDs for each team's slots, kept
  // regardless of whether any given slot resolved to a real User. Not
  // positionally tied to team1Ids/team2Ids — just every non-empty DUPR ID
  // submitted for that team. Optional; DUPR-sourced calls never pass these.
  team1DuprIds?: string[];
  team2DuprIds?: string[];
}
export async function createMatch(data: MatchCreationData & { 
  processedUsers: string[] | null, team1Names?: string[], team2Names?: string[] 
}, dbOptions: RequiredDbOptions) {
  const cleanIds = (ids: (string | null)[]) => ids.filter(id => id && Types.ObjectId.isValid(id));

  const cleanName = (name: string | undefined | null) => {
    if (!name) return "Unclaimed Account";
    
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    
    if (lower === "a dupr user" || lower === "dupr user" || lower === "private profile") {
        return "Unclaimed Account";
    }
    return trimmed;
  };

  const finalTeam1Names = (data.team1Names || []).map(cleanName);
  const finalTeam2Names = (data.team2Names || []).map(cleanName);

  // [Program pivot] Required-together check — only enforced when programId
  // is present, so DUPR-sourced calls (which never pass it) are untouched.
  if (data.programId) {
    const missing: string[] = [];
    if (!data.sourceMatchId) missing.push('sourceMatchId');
    if (!data.matchType) missing.push('matchType');
    if (!data.division) missing.push('division');
    if (missing.length > 0) {
      throw new Error(`Program-sourced matches require: ${missing.join(', ')}.`);
    }
  }

  const createdMatches = await Match.create(
    [{
      matchId: uuidv4(),
      matchDate: data.matchDate,
      duprMatchId: data.duprMatchId,
      duprGameNumber: data.duprGameNumber,
      duprEvent: data.eventName,
      location: data.location,
      // [Program pivot] NEW fields — undefined for existing DUPR-sourced
      // calls, exactly as before (no schema-level `required: true` on any
      // of these — see app/models/Match.ts).
      sourceMatchId: data.sourceMatchId,
      matchType: data.matchType,
      programId: data.programId,
      division: data.division,
      team1DuprIds: data.team1DuprIds,
      team2DuprIds: data.team2DuprIds,
      team1: { 
          players: cleanIds(data.team1Ids), 
          playerNames: finalTeam1Names,
          score: data.team1Score 
      },
      team2: { 
          players: cleanIds(data.team2Ids), 
          playerNames: finalTeam2Names,
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

  return createdMatches[0];
}