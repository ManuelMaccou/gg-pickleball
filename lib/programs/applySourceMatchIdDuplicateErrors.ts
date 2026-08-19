export interface RowWithSourceMatchId {
  sourceMatchId?: string;
  validationErrors: string[];
}

const DUPLICATE_ERROR = 'This Source Match ID appears more than once in this file.';

export function applySourceMatchIdDuplicateErrors<T extends RowWithSourceMatchId>(rows: T[]): T[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.sourceMatchId) counts.set(row.sourceMatchId, (counts.get(row.sourceMatchId) ?? 0) + 1);
  }

  for (const row of rows) {
    const isDuplicate = !!row.sourceMatchId && (counts.get(row.sourceMatchId) ?? 0) > 1;
    const hasError = row.validationErrors.includes(DUPLICATE_ERROR);
    if (isDuplicate && !hasError) {
      row.validationErrors.push(DUPLICATE_ERROR);
    } else if (!isDuplicate && hasError) {
      row.validationErrors = row.validationErrors.filter((e) => e !== DUPLICATE_ERROR);
    }
  }

  return rows;
}