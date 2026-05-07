// lib/services/dupr/duprMatches.ts
//
// Thin wrappers around DUPR's match endpoints. Auth (token caching, 401 retry)
// is handled by authenticatedDuprFetch. These functions do two things:
//   1. Translate our internal match shape into DUPR's payload shape
//   2. Throw descriptive errors on non-2xx so callers can stamp submission status

import { IUploadedMatchTeam } from '@/app/types/databaseTypes';
import { authenticatedDuprFetch } from './duprAuth';

// Adjust if DUPR publishes a new version
const DUPR_MATCH_API_VERSION = '1.0';

const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;

// ---- Types --------------------------------------------------------------

// Shape we accept from callers — essentially what our schema stores
export interface DuprMatchInput {
  matchDate: Date | string;
  teamA: IUploadedMatchTeam;
  teamB: IUploadedMatchTeam;
  location?: string;
  clubDuprId?: string; // DUPR's club ID on the club record (numeric in their docs)
  identifier?: string; // our local _id, round-trips back in responses
  eventName?: string;
}

// Shape DUPR expects in the payload body
interface DuprMatchPayload {
  matchDate: string;
  location?: string;
  format: 'DOUBLES';
  matchSource: 'CLUB';
  matchType: string;
  event: string;
  clubId?: number;
  identifier?: string;
  teamA: DuprTeamPayload;
  teamB: DuprTeamPayload;
}

interface DuprTeamPayload {
  player1: string;
  player2: string;
  game1: number;
  game2: number;
  game3: number;
  game4: number;
  game5: number;
}

// ---- Helpers ------------------------------------------------------------

const toYMD = (d: Date | string): string => {
  if (typeof d === 'string') {
    // Accept 'yyyy-MM-dd' as-is, or ISO strings that we truncate
    return d.length >= 10 ? d.slice(0, 10) : d;
  }
  return d.toISOString().slice(0, 10);
};

const teamToDupr = (t: IUploadedMatchTeam): DuprTeamPayload => ({
  player1: t.player1.duprId,
  player2: t.player2.duprId,
  game1: t.game1 ?? 0,
  game2: t.game2 ?? 0,
  game3: t.game3 ?? 0,
  game4: t.game4 ?? 0,
  game5: t.game5 ?? 0,
});

const buildPayload = (m: DuprMatchInput): DuprMatchPayload => ({
  matchDate: toYMD(m.matchDate),
  location: m.location,
  format: 'DOUBLES',
  matchSource: 'CLUB',
  matchType: 'SIDEOUT',
  event: m.eventName ?? 'Open Play',
  clubId: Number(m.clubDuprId),
  identifier: m.identifier,
  teamA: teamToDupr(m.teamA),
  teamB: teamToDupr(m.teamB),
});

const parseOrThrow = async (res: Response, context: string) => {
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = text; }

  // Handle non-2xx responses
  if (!res.ok) {
    if (body && typeof body === 'object') {
      const b = body as { message?: string; errors?: Record<string, string[]> };

      // Extract field-level errors if present
      let errorDetails = '';
      if (b.errors && typeof b.errors === 'object') {
        errorDetails = Object.entries(b.errors)
          .map(([field, messages]) => {
            const msgs = Array.isArray(messages) ? messages.join('. ') : String(messages);
            return `${field}: ${msgs}`;
          })
          .join('; ');
      }

      if (errorDetails) {
        throw new Error(errorDetails);
      }
      if (b.message) {
        throw new Error(b.message);
      }
    }
    if (typeof body === 'string' && body.includes('<html')) {
      throw new Error(`DUPR ${context}: endpoint returned ${res.status}. Check your API URL configuration.`);
    }
    throw new Error(`DUPR ${context} failed (${res.status})`);
  }

  // Handle 200 responses with FAILURE status
  if (body && typeof body === 'object') {
    const b = body as { status?: string; message?: string; errors?: Record<string, string[]> };

    if (b.status === 'FAILURE') {
      let errorDetails = '';
      if (b.errors && typeof b.errors === 'object') {
        errorDetails = Object.entries(b.errors)
          .map(([field, messages]) => {
            const msgs = Array.isArray(messages) ? messages.join('. ') : String(messages);
            return `${field}: ${msgs}`;
          })
          .join('; ');
      }

      throw new Error(errorDetails || b.message || `DUPR ${context} failed`);
    }
  }

  return body as { status?: string; result?: unknown; message?: string };
};
// ---- Single-match create ------------------------------------------------

export async function submitMatchToDupr(
  input: DuprMatchInput
): Promise<{ matchId: string }> {
    
  console.log('[DUPR Create] Payload:', JSON.stringify(buildPayload(input), null, 2));

  const url = `https://${DUPR_API_BASE_URL}/api/match/${DUPR_MATCH_API_VERSION}/create`;
  const res = await authenticatedDuprFetch(url, {
    method: 'POST',
    body: JSON.stringify(buildPayload(input)),
  });
  
  const body = await parseOrThrow(res, 'match create');

  // DUPR wraps responses as { status, result }. The result for create is
  // typically the created match object or its ID. Handle both shapes.
  const result = body.result as { matchCode?: string; id?: string } | string | undefined;
  const matchId =
    typeof result === 'string'
      ? result
      : result?.matchCode ?? result?.id;

  if (!matchId) {
    throw new Error(`DUPR match create returned no matchCode: ${JSON.stringify(body)}`);
  }
  return { matchId };
}

// ---- Batch create -------------------------------------------------------

export async function submitMatchBatchToDupr(
  inputs: DuprMatchInput[]
): Promise<Array<{ ok: true; matchId: string } | { ok: false; error: string }>> {
  if (inputs.length === 0) return [];

  const url = `https://${DUPR_API_BASE_URL}/api/match/${DUPR_MATCH_API_VERSION}/batch`;
  const payload = inputs.map(buildPayload);

  const res = await authenticatedDuprFetch(url, {
    method: 'POST',
    // DUPR's batch endpoint — adjust the wrapping key if their docs specify one
    // (some APIs want { matches: [...] }, others accept a raw array). Start raw.
    body: JSON.stringify(payload),
  });
  const body = await parseOrThrow(res, 'match batch create');

  // Expect result to be an array in the same order as inputs.
  // Each entry may be a string id, an object with matchId, or an error object.
  const rawResult = body.result as { matchCodes?: unknown[]; errors?: unknown[] } | unknown[] | undefined;
  const result = Array.isArray(rawResult) ? rawResult : (rawResult as any)?.matchCodes;

  // Check for batch-level errors
  const batchErrors = Array.isArray(rawResult) ? [] : (rawResult as any)?.errors ?? [];

  if (batchErrors.length > 0) {
    console.warn('[DUPR Batch] Errors returned:', batchErrors);
  }

  if (!Array.isArray(result)) {
    throw new Error(`DUPR batch response was not an array: ${JSON.stringify(body)}`);
  }
  // Match results back to inputs using identifier (not array position)
  // DUPR only returns successful matches in matchCodes, failures go in batchErrors
  const successMap = new Map<string, string>();
  for (const entry of result) {
    if (entry && typeof entry === 'object') {
      const e = entry as { identifier?: string; matchCode?: string; matchId?: string; id?: string };
      const id = e.matchCode ?? e.matchId ?? e.id;
      if (e.identifier && id) {
        successMap.set(e.identifier, id);
      }
    }
  }

  // Build error map from batch errors
  const errorMap = new Map<string, string>();
  if (batchErrors.length > 0) {
    for (const err of batchErrors) {
      if (err && typeof err === 'object') {
        const e = err as { identifier?: string; message?: string; error?: string };
        if (e.identifier) {
          errorMap.set(e.identifier, e.message ?? e.error ?? 'Unknown DUPR error');
        }
      }
    }
  }

  return inputs.map((input) => {
    const identifier = input.identifier ?? '';
    if (successMap.has(identifier)) {
      return { ok: true as const, matchId: successMap.get(identifier)! };
    }
    if (errorMap.has(identifier)) {
      return { ok: false as const, error: errorMap.get(identifier)! };
    }
    return { ok: false as const, error: 'No response from DUPR for this match' };
  });
}

// ---- Update -------------------------------------------------------------

export async function updateMatchOnDupr(
  duprMatchId: string,
  identifier: string,
  input: DuprMatchInput
): Promise<void> {
  const url = `https://${DUPR_API_BASE_URL}/api/match/${DUPR_MATCH_API_VERSION}/update`;

  const payload = {
    matchId: duprMatchId,
    identifier,
    ...buildPayload(input),
  };

  const res = await authenticatedDuprFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await parseOrThrow(res, 'match update');
}

// ---- Delete -------------------------------------------------------------

export async function deleteMatchOnDupr(duprMatchId: string, matchId: string): Promise<void> {
  const url = `https://${DUPR_API_BASE_URL}/api/match/${DUPR_MATCH_API_VERSION}/delete`;
  const res = await authenticatedDuprFetch(url, {
    method: 'DELETE',
    body: JSON.stringify({
      matchCode: duprMatchId,
      identifier: matchId
    }),
  });
  await parseOrThrow(res, 'match delete');
}