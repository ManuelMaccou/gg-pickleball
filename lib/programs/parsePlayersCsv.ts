import Papa from 'papaparse';
import { validatePlayerRow, ValidatedPlayerRowCore } from './validatePlayerRow';
import { applyDuprIdDuplicateWarnings } from './applyDuprIdDuplicateWarnings';

export interface ParsedPlayerRow extends ValidatedPlayerRowCore {
  rowNumber: number;
  warnings: string[];
}

export interface ParsePlayersCsvResult {
  rows: ParsedPlayerRow[];
  fileErrors: string[];
}

const REQUIRED_HEADERS = ['name', 'email', 'dupr id', 'date of birth', 'age'];

const normalizeHeader = (h: string): string => h.trim().toLowerCase().replace(/\s+/g, ' ');

export function parsePlayersCsv(csvText: string): ParsePlayersCsvResult {
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

  const rows: ParsedPlayerRow[] = parsed.data.map((raw, i) => {
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row
    const validated = validatePlayerRow({
      name: raw['name'],
      email: raw['email'],
      duprId: raw['dupr id'],
      dateOfBirth: raw['date of birth'],
      age: raw['age'],
    });
    return { rowNumber, ...validated, warnings: [] };
  });

  applyDuprIdDuplicateWarnings(rows);

  return { rows, fileErrors };
}