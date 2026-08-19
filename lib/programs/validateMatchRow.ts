// Destination: lib/programs/validateMatchRow.ts
//
// [Under-13 handling] Blank Player 1 (always-required) and Player 2
// (doubles-only) DUPR ID slots used to be hard validationErrors. Now
// they're warnings instead — still visible on the preview screen, but no
// longer blocking. This is what makes the manual-pre-filtering workflow
// possible: an admin who's already stripped an under-13 participant's
// DUPR ID (and email/name) out of the raw tournament data before it ever
// reaches this CSV can leave that slot blank and still confirm the row —
// the score/outcome still gets recorded for the OTHER participants in the
// same match, exactly as the original under-13 design always intended.
//
// Deliberately NOT silent, though — a blank slot could just as easily be
// a genuine accidental omission (staff forgot to fill in a real adult's
// ID) as an intentional removal, and this CSV has no way to tell those
// two apart on its own. The warning exists so a human gets one more look
// before confirming, same non-blocking-but-visible pattern already used
// for Players Upload's duplicate-DUPR-ID check and Matches Upload's
// already-processed-row marker.
//
// This function only checks that the row is well-formed on its
// own terms.
//
// Duplicate sourceMatchId detection is file-wide, not per-row, so it's not
// here either — same split as Players' duplicate-DUPR-ID check.

import { DateTime } from 'luxon';

export interface RawMatchRowInput {
  sourceMatchId?: string;
  division?: string;
  matchType?: string;
  matchDate?: string;
  team1Score?: string | number;
  team2Score?: string | number;
  team1Player1DuprId?: string;
  team1Player2DuprId?: string;
  team2Player1DuprId?: string;
  team2Player2DuprId?: string;
}

export interface ValidatedMatchRowCore {
  sourceMatchId?: string;
  division?: string;
  matchType?: 'singles' | 'doubles';
  matchDate?: string;
  team1Score?: number;
  team2Score?: number;
  team1Player1DuprId?: string;
  team1Player2DuprId?: string;
  team2Player1DuprId?: string;
  team2Player2DuprId?: string;
  validationErrors: string[];
  warnings: string[];
}

function parseScore(raw: string | number | undefined, label: string, errors: string[]): number | undefined {
  const str = (raw ?? '').toString().trim();
  if (!str) {
    errors.push(`${label} is required.`);
    return undefined;
  }
  const n = Number(str);
  if (!Number.isInteger(n) || n < 0) {
    errors.push(`${label} must be a whole, non-negative number.`);
    return undefined;
  }
  return n;
}

export function validateMatchRow(input: RawMatchRowInput): ValidatedMatchRowCore {
  const validationErrors: string[] = [];
  const warnings: string[] = [];

  const sourceMatchId = (input.sourceMatchId ?? '').toString().trim();
  const division = (input.division ?? '').toString().trim();
  const matchTypeRaw = (input.matchType ?? '').toString().trim().toLowerCase();
  const matchDateRaw = (input.matchDate ?? '').toString().trim();
  const t1p1 = (input.team1Player1DuprId ?? '').toString().trim();
  const t1p2 = (input.team1Player2DuprId ?? '').toString().trim();
  const t2p1 = (input.team2Player1DuprId ?? '').toString().trim();
  const t2p2 = (input.team2Player2DuprId ?? '').toString().trim();

  if (!sourceMatchId) validationErrors.push('Source Match ID is required.');
  if (!division) validationErrors.push('Division is required.');

  let matchType: 'singles' | 'doubles' | undefined;
  if (matchTypeRaw !== 'singles' && matchTypeRaw !== 'doubles') {
    validationErrors.push('Match Type must be exactly "singles" or "doubles".');
  } else {
    matchType = matchTypeRaw;
  }

  let matchDate: string | undefined;
  if (!matchDateRaw) {
    validationErrors.push('Match Date is required.');
  } else if (!DateTime.fromISO(matchDateRaw).isValid) {
    validationErrors.push('Match Date is not a valid date — use YYYY-MM-DD.');
  } else {
    matchDate = matchDateRaw;
  }

  const team1Score = parseScore(input.team1Score, 'Team 1 Score', validationErrors);
  const team2Score = parseScore(input.team2Score, 'Team 2 Score', validationErrors);

  const BLANK_SLOT_WARNING =
    'DUPR ID is blank — this slot will be treated as a non-account-holding participant ' +
    '(e.g. an under-13 player already removed from the raw data). Only their score/outcome ' +
    'is recorded, no identifying data. Confirm this is intentional, not a data-entry omission.';

  // Player 1 slots are expected regardless of match type — every match has
  // at least one player per team. A blank slot no longer blocks the row —
  // see file header — but is still flagged for a human to confirm.
  if (!t1p1) warnings.push(`Team 1 Player 1 ${BLANK_SLOT_WARNING}`);
  if (!t2p1) warnings.push(`Team 2 Player 1 ${BLANK_SLOT_WARNING}`);

  // Player 2 slots are gated on match type — only check this once matchType
  // itself is valid, to avoid piling a confusing secondary warning/error on
  // top of an already-flagged invalid Match Type.
  if (matchType === 'doubles') {
    if (!t1p2) warnings.push(`Team 1 Player 2 ${BLANK_SLOT_WARNING}`);
    if (!t2p2) warnings.push(`Team 2 Player 2 ${BLANK_SLOT_WARNING}`);
  } else if (matchType === 'singles') {
    // Unchanged — a POPULATED slot on a singles match is still a real
    // contradiction (wrong match type, or a stray value), not an
    // ambiguous "maybe intentional" case, so this stays a hard error.
    if (t1p2) {
      validationErrors.push(
        'Match Type is singles but Team 1 Player 2 DUPR ID has a value — remove it or change Match Type to doubles.'
      );
    }
    if (t2p2) {
      validationErrors.push(
        'Match Type is singles but Team 2 Player 2 DUPR ID has a value — remove it or change Match Type to doubles.'
      );
    }
  }

  return {
    sourceMatchId: sourceMatchId || undefined,
    division: division || undefined,
    matchType,
    matchDate,
    team1Score,
    team2Score,
    team1Player1DuprId: t1p1 || undefined,
    team1Player2DuprId: t1p2 || undefined,
    team2Player1DuprId: t2p1 || undefined,
    team2Player2DuprId: t2p2 || undefined,
    validationErrors,
    warnings,
  };
}