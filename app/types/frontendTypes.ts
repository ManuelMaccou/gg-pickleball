export interface FrontendClientStats {
  checkins?: Date[];
  wins?: number;
  losses?: number;
  winStreak?: number;
  pointsWon?: number;
  matches?: string[]; // object ids are strings on frontend
  achievements: Record<string, { count?: number; earnedAt: Date[] }>;
  rewards: Record<string, { redeemed: boolean; redemptionDate?: Date }>;
}

export interface FrontendUser {
  _id: string;
  name: string;
  auth0Id?: string;
  email?: string;
  profilePicture?: string;
  lastLocation?: string;
  stats: Record<string, FrontendClientStats>;
}
