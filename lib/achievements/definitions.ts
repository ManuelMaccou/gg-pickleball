/**
 * @file This file is the single source of truth for all achievement definitions.
 * It maps achievement keys to their corresponding checker functions and metadata names.
 * This centralized approach ensures consistency across the application.
 */

/**
 * The canonical list of all achievements.
 * `key`: The unique database identifier for the achievement (e.g., 'first-win').
 * `name`: The name of the function group this achievement belongs to (e.g., 'firstWin').
 * `checkFn`: A direct reference to the server function that checks if the achievement is earned.
 */
export const achievementDefinitions: { key: string; name: string }[] = [
  // Visit Achievements
  { key: 'visit-1', name: 'visit' },
  { key: 'visit-5', name: 'visit' },
  { key: 'visit-10', name: 'visit' },
  { key: 'visit-15', name: 'visit' },
  { key: 'visit-20', name: 'visit' },
  { key: 'visit-25', name: 'visit' },
  { key: 'visit-30', name: 'visit' },
  { key: 'visit-35', name: 'visit' },
  { key: 'visit-40', name: 'visit' },
  { key: 'visit-45', name: 'visit' },
  { key: 'visit-50', name: 'visit' },
  { key: 'visit-100', name: 'visit' },

  // Win Achievements
  { key: 'first-win', name: 'firstWin' },
  { key: '5-wins', name: 'totalWins' },
  { key: '10-wins', name: 'totalWins' },
  { key: '20-wins', name: 'totalWins'},
  { key: '30-wins', name: 'totalWins' },
  { key: '40-wins', name: 'totalWins' },
  { key: '50-wins', name: 'totalWins' },
  { key: '100-wins', name: 'totalWins' },
  { key: '200-wins', name: 'totalWins' },

  // Streak Achievements
  { key: '2-win-streak', name: 'winStreak' },
  { key: '5-win-streak', name: 'winStreak' },
  { key: '7-win-streak', name: 'winStreak' },
  { key: '10-win-streak', name: 'winStreak' },
  { key: '15-win-streak', name: 'winStreak' },
  { key: 'win-streak-breaker', name: 'winStreakBreaker' },

  // Matches Played Achievements
  { key: '1-matches-played', name: 'matchesPlayed' },
  { key: '10-matches-played', name: 'matchesPlayed' },
  { key: '20-matches-played', name: 'matchesPlayed' },
  { key: '50-matches-played', name: 'matchesPlayed' },
  { key: '100-matches-played', name: 'matchesPlayed' },
  { key: '150-matches-played', name: 'matchesPlayed' },
  { key: '200-matches-played', name: 'matchesPlayed' },
  { key: '250-matches-played', name: 'matchesPlayed' },
  { key: '300-matches-played', name: 'matchesPlayed' },
  { key: '350-matches-played', name: 'matchesPlayed' },
  { key: '400-matches-played', name: 'matchesPlayed' },
  { key: '450-matches-played', name: 'matchesPlayed' },
  { key: '500-matches-played', name: 'matchesPlayed' },
  { key: '600-matches-played', name: 'matchesPlayed' },
  { key: '700-matches-played', name: 'matchesPlayed' },
  { key: '800-matches-played', name: 'matchesPlayed' },
  { key: '900-matches-played', name: 'matchesPlayed' },
  { key: '1000-matches-played', name: 'matchesPlayed' },

  // Other Achievements
  { key: 'pickle', name: 'pickle' },

  // Points Won Achievements
  { key: '50-points-won', name: 'pointsWon' },
  { key: '100-points-won', name: 'pointsWon' },
  { key: '200-points-won', name: 'pointsWon' },
  { key: '300-points-won', name: 'pointsWon' },
  { key: '400-points-won', name: 'pointsWon' },
  { key: '500-points-won', name: 'pointsWon' },
];

/**
 * A map of achievement keys to their function group names.
 * This is programmatically generated from the `achievementCheckers` array
 * to ensure it's always in sync and is used by API routes to look up metadata.
 * e.g., { 'first-win': 'firstWin', '5-wins': 'totalWins' }
 */
export const achievementKeyToFunctionName = achievementDefinitions.reduce((acc, checker) => {
  acc[checker.key] = checker.name;
  return acc;
}, {} as Record<string, string>);