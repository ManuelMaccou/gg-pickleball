import { CsvRowData } from "@/app/types/bulkUploadTypes";

const REQUIRED_HEADERS = [
  'team1_player1_name', 'team1_player1_email',
  'team1_player2_name', 'team1_player2_email',
  'team2_player1_name', 'team2_player1_email',
  'team2_player2_name', 'team2_player2_email',
  'team1_score', 'team2_score'
];

/**
 * Performs an all-or-nothing validation on the parsed CSV data.
 * @param matches - The array of rows parsed from the CSV.
 * @returns An error message string if validation fails, otherwise null.
 */
export function validateCsvData(matches: CsvRowData[]): string | null {
  if (!matches || matches.length === 0) {
    return "CSV file is empty or could not be parsed.";
  }

  const firstRow = matches[0];
  const headers = Object.keys(firstRow);

  // Check if all required headers are present
  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      return `CSV is missing required header column: "${requiredHeader}"`;
    }
  }
  
  // Check each row for required values
  for (let i = 0; i < matches.length; i++) {
    const row = matches[i];
    if (!row.team1_player1_name || !row.team1_player1_email || 
        !row.team1_player2_name || !row.team1_player2_email ||
        !row.team2_player1_name || !row.team2_player1_email ||
        !row.team2_player2_name || !row.team2_player2_email ||
        !row.team1_score || !row.team2_score
    ) {
      return `Row ${i + 2} is missing one or more required values.`;
    }
  }

  return null; // All good
}