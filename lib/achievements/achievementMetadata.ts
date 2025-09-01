export const achievementFunctionMetadata: Record<string, { repeatable: boolean }> = {
  // Non-Repeatable Functions
  'visit': { repeatable: false },
  'firstWin': { repeatable: false },
  'totalWins': { repeatable: false },
  'matchesPlayed': { repeatable: false },
  'pointsWon': { repeatable: false },
  
  // Repeatable Functions
  'winStreak': { repeatable: true },
  'winStreakBreaker': { repeatable: true },
  'pickle': { repeatable: true },
};