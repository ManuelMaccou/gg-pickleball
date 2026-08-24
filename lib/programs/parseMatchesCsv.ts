// Same shape as parsePlayersCsv — parses, validates each
// row via the extracted pure function, then applies the one file-wide
// check (duplicate Source Match ID) that can't be evaluated per-row in
// isolation. Unlike Players' duplicate-DUPR-ID check, this one is a
// blocking error, not a warning —
// a repeated Source Match ID within one file is a real data problem, not
// just something worth a heads-up.
//
//
// Expected CSV columns (case-insensitive, trimmed): Source Match ID,
// Division, Match Type, Match Date, Team 1 Score, Team 2 Score,
// Team 1 Player 1 DUPR ID, Team 1 Player 2 DUPR ID, Team 2 Player 1 DUPR ID,
// Team 2 Player 2 DUPR ID. Match Date expected as YYYY-MM-DD. Player 2
// columns are only required when Match Type is doubles.

import Papa from 'papaparse';
import { validateMatchRow, ValidatedMatchRowCore } from './validateMatchRow';
import { applySourceMatchIdDuplicateErrors } from './applySourceMatchIdDuplicateErrors';

export interface ParsedMatchRow extends ValidatedMatchRowCore {
  rowNumber: number;
}

export interface ParseMatchesCsvResult {
  rows: ParsedMatchRow[];
  fileErrors: string[];
}

const REQUIRED_HEADERS = [
  'source match id',
  'division',
  'match type',
  'match date',
  'team 1 score',
  'team 2 score',
  'team 1 player 1 dupr id',
  'team 1 player 2 dupr id',
  'team 2 player 1 dupr id',
  'team 2 player 2 dupr id',
];

const normalizeHeader = (h: string): string => h.trim().toLowerCase().replace(/\s+/g, ' ');

export function parseMatchesCsv(csvText: string): ParseMatchesCsvResult {
  const fileErrors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    fileErrors.push(
      ...parsed.errors.slice(0, 5).map((e) => `CSV parse error: ${e.message} (row ${e.row ?? '?'})`)
    );
  }

  const actualHeaders = new Set((parsed.meta.fields ?? []).map((f) => normalizeHeader(f)));
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !actualHeaders.has(h));
  if (missingHeaders.length > 0) {
    fileErrors.push(
      `Missing required column(s): ${missingHeaders.join(', ')}. Check the column headers match exactly.`
    );
    return { rows: [], fileErrors };
  }

  if (parsed.data.length === 0) {
    fileErrors.push('No data rows found in this file.');
    return { rows: [], fileErrors };
  }

  const rows: ParsedMatchRow[] = parsed.data.map((raw, i) => {
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row
    const validated = validateMatchRow({
      sourceMatchId: raw['source match id'],
      division: raw['division'],
      matchType: raw['match type'],
      matchDate: raw['match date'],
      team1Score: raw['team 1 score'],
      team2Score: raw['team 2 score'],
      team1Player1DuprId: raw['team 1 player 1 dupr id'],
      team1Player2DuprId: raw['team 1 player 2 dupr id'],
      team2Player1DuprId: raw['team 2 player 1 dupr id'],
      team2Player2DuprId: raw['team 2 player 2 dupr id'],
    });
    return { rowNumber, ...validated };
  });

  applySourceMatchIdDuplicateErrors(rows);

  return { rows, fileErrors };
}