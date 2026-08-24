export interface RowWithDuprId {
  duprId?: string;
  warnings: string[];
}

const DUPLICATE_WARNING = 'This DUPR ID appears more than once in this file.';

// Mutates each row's `warnings` in place: adds the duplicate notice where
// it now applies, removes it where it no longer does. Call this against the
// FULL row set any time a row's duprId changes — a single row can't be
// checked in isolation, since "duplicate" is a property of the whole file.
export function applyDuprIdDuplicateWarnings<T extends RowWithDuprId>(rows: T[]): T[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.duprId) counts.set(row.duprId, (counts.get(row.duprId) ?? 0) + 1);
  }

  for (const row of rows) {
    const isDuplicate = !!row.duprId && (counts.get(row.duprId) ?? 0) > 1;
    const hasWarning = row.warnings.includes(DUPLICATE_WARNING);
    if (isDuplicate && !hasWarning) {
      row.warnings.push(DUPLICATE_WARNING);
    } else if (!isDuplicate && hasWarning) {
      row.warnings = row.warnings.filter((w) => w !== DUPLICATE_WARNING);
    }
  }

  return rows;
}