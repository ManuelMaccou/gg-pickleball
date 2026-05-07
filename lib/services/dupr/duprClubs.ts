// lib/services/dupr/duprClubs.ts
//
// Fetches the clubs a user belongs to from DUPR, filtered to roles
// that are allowed to submit matches (ORGANIZER, DIRECTOR).
// Auto-refreshes expired tokens via authenticatedDuprUserFetch.

import { authenticatedDuprUserFetch } from './duprUserAuth';

const ALLOWED_ROLES = ['ORGANIZER', 'DIRECTOR'];

export interface DuprClubMembership {
  clubId: number;
  clubName: string;
  role: string;
}

/**
 * Fetches clubs the user is a member of from DUPR.
 * Filters to ORGANIZER and DIRECTOR roles only.
 * Auto-refreshes expired tokens.
 */
export async function fetchUserDuprClubs(userId: string): Promise<DuprClubMembership[]> {
  const DUPR_BACKEND_API_BASE_URL = process.env.DUPR_BACKEND_API_BASE_URL;
  if (!DUPR_BACKEND_API_BASE_URL) {
    throw new Error('Missing DUPR API configuration.');
  }

  const response = await authenticatedDuprUserFetch(
    userId,
    `https://${DUPR_BACKEND_API_BASE_URL}/user/club/membership`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[DUPR Clubs] API failed (${response.status}):`, errText);
    throw new Error('Failed to fetch your DUPR clubs. Please try again later.');
  }

  const data = await response.json();

  const memberships: DuprClubMembership[] = [];
  const clubs = data.membership ?? data.result ?? data;

  if (Array.isArray(clubs)) {
    for (const club of clubs) {
      if (club.clubId && club.role && ALLOWED_ROLES.includes(club.role)) {
        memberships.push({
          clubId: club.clubId,
          clubName: club.clubName ?? `Club ${club.clubId}`,
          role: club.role,
        });
      }
    }
  }

  return memberships;
}