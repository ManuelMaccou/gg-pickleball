// The two informational annotations a Matches preview needs
// — "this Source Match ID is already committed" and "this DUPR ID doesn't
// match any Player Account" — both depend on live database state, not
// anything in the CSV itself, and can change between when a row is parsed
// and when it's viewed (e.g. staff runs the Players upload again in
// between, or a previous partial confirm already committed some rows).
// So this is called fresh every time a preview is returned to the client,
// rather than computed once and stored — same "derive, don't store"
// pattern as Players upload progress (Requirements doc, Section 10.10).

import Match from '@/app/models/Match';
import User from '@/app/models/User';

export interface MatchRowLike {
  sourceMatchId?: string;
  team1Player1DuprId?: string;
  team1Player2DuprId?: string;
  team2Player1DuprId?: string;
  team2Player2DuprId?: string;
}

export interface PlayerSlotStatus {
  duprId: string;
  matched: boolean;
  name?: string;
}

export interface EnrichedFields {
  alreadyProcessed: boolean;
  team1Player1Match?: PlayerSlotStatus;
  team1Player2Match?: PlayerSlotStatus;
  team2Player1Match?: PlayerSlotStatus;
  team2Player2Match?: PlayerSlotStatus;
}

export async function enrichMatchRows<T extends MatchRowLike>(
  rows: T[]
): Promise<(T & EnrichedFields)[]> {

  const normalizedRows = rows.map((r: any) =>
    typeof r?.toObject === 'function' ? r.toObject() : r
  ) as T[];

  const sourceMatchIds = normalizedRows.map((r) => r.sourceMatchId).filter((id): id is string => !!id);
  const existingMatches = sourceMatchIds.length
    ? await Match.find({ sourceMatchId: { $in: sourceMatchIds } })
        .select('sourceMatchId')
        .lean()
    : [];
  const processedIds = new Set(existingMatches.map((m) => m.sourceMatchId));

  const allDuprIds = new Set<string>();
  for (const r of normalizedRows) {
    [r.team1Player1DuprId, r.team1Player2DuprId, r.team2Player1DuprId, r.team2Player2DuprId].forEach(
      (id) => {
        if (id) allDuprIds.add(id);
      }
    );
  }
  const users = allDuprIds.size
    ? await User.find({ 'dupr.id': { $in: [...allDuprIds] } })
        .select('dupr.id name')
        .lean()
    : [];
  const userByDuprId = new Map(users.map((u) => [u.dupr?.id, u]));

  const slotStatus = (duprId?: string): PlayerSlotStatus | undefined => {
    if (!duprId) return undefined;
    const user = userByDuprId.get(duprId);
    return { duprId, matched: !!user, name: user?.name };
  };

  return normalizedRows.map((row) => ({
    ...row,
    alreadyProcessed: row.sourceMatchId ? processedIds.has(row.sourceMatchId) : false,
    team1Player1Match: slotStatus(row.team1Player1DuprId),
    team1Player2Match: slotStatus(row.team1Player2DuprId),
    team2Player1Match: slotStatus(row.team2Player1DuprId),
    team2Player2Match: slotStatus(row.team2Player2DuprId),
  }));
}