export interface PlayByPointProcessedAvailability {
  day: string;
  date: string;
  time: string; 
  available: boolean;
}

export interface PlayByPointScrapedHour {
  schedule: string;
  available: boolean;
}

export interface PlayByPointScrapedEntry {
  date: string;
  data: {
    available_hours: PlayByPointScrapedHour[];
  };
}

export interface CourtReserveScrapedEntry {
  Title?: string;
  Start: string;
  End: string;
  ReservationType?: string;
  CourtLabel?: string;
  IsFull?: boolean;
  IsCanceled?: boolean;
}

export interface TimeBlock {
  start: string;
  end: string;
};

export type AvailabilityState = Record<string, TimeBlock[]>;

export interface ApiErrorResponse {
  systemMessage: string;
  userMessage: string;
}