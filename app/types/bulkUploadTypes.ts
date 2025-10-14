export interface CsvRowData {
  team1_player1_name: string; team1_player1_email: string;
  team1_player2_name: string; team1_player2_email: string;
  team2_player1_name: string; team2_player1_email: string;
  team2_player2_name: string; team2_player2_email: string;
  team1_score: string;
  team2_score: string;
  winner_team: 'team1' | 'team2';
}

export interface BulkUploadPayload {
  matches: CsvRowData[];
  location: string;
}

export interface Job {
  status: 'processing' | 'complete' | 'failed';
  results: JobResult[];
  createdAt?: Date;
}

export interface JobResult {
  row: number;
  status: 'success' | 'user_error' | 'server_error';
  message: string;
  data: {
    players: string[];
    score: string;
  } | null; // Null for cases where we can't parse it
}

export interface RowContextData {
  players: string[];
  score: string;
}