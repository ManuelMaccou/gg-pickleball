// lib/services/dupr/duprUserAuth.ts
//
// Handles per-user DUPR authentication: token refresh on 401,
// and a fetch wrapper that auto-retries with a fresh token.
//
// This is SEPARATE from duprAuth.ts which handles app-level
// client credentials for server-to-server match CRUD.

import User from '@/app/models/User';

const DUPR_BACKEND_API_BASE_URL = process.env.DUPR_BACKEND_API_BASE_URL;

interface UserTokens {
  userToken: string;
  refreshToken: string;
}

/**
 * Refreshes a user's DUPR access token using their refresh token.
 * Saves both new tokens to the user document.
 *
 * @returns The new access token, or throws on failure.
 */
export async function refreshDuprUserToken(userId: string): Promise<string> {
  const user = await User.findById(userId).select('dupr.refreshToken').lean() as {
    dupr?: { refreshToken?: string };
  } | null;

  if (!user?.dupr?.refreshToken) {
    throw new Error('No DUPR refresh token available. Please reconnect your DUPR account.');
  }

 const response = await fetch(`https://${DUPR_BACKEND_API_BASE_URL}/auth/v2.0/refresh`, {
    method: 'GET',
    headers: {
      'x-refresh-token': user.dupr.refreshToken,
      'accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[DUPR Token Refresh] Failed (${response.status}):`, errText);

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Your DUPR session has expired. Please reconnect your DUPR account.');
    }
    throw new Error('Failed to refresh DUPR token. Please try again later.');
  }

  const data = await response.json();

  if (data.status === 'FAILURE') {
    throw new Error(data.message ?? 'DUPR token refresh failed.');
  }

  const newAccessToken = data.result?.accessToken;
  const newRefreshToken = data.result?.refreshToken;

  if (!newAccessToken) {
    throw new Error('DUPR token refresh returned no access token.');
  }

  // Save both new tokens to user document
  const updateFields: Record<string, string> = {
    'dupr.userToken': newAccessToken,
  };
  if (newRefreshToken) {
    updateFields['dupr.refreshToken'] = newRefreshToken;
  }

  await User.findByIdAndUpdate(userId, { $set: updateFields });

  console.log(`[DUPR Token Refresh] Successfully refreshed token for user ${userId}`);
  return newAccessToken;
}

/**
 * Makes a fetch call using the user's DUPR token.
 * On 401, automatically refreshes the token and retries once.
 *
 * @param userId - MongoDB user _id
 * @param url - Full URL to call
 * @param options - Fetch options (method, body, etc). Authorization header is added automatically.
 * @returns The fetch Response
 */
export async function authenticatedDuprUserFetch(
  userId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 1. Get current token
  const user = await User.findById(userId).select('dupr.userToken').lean() as {
    dupr?: { userToken?: string };
  } | null;

  if (!user?.dupr?.userToken) {
    throw new Error('DUPR account not connected. Please connect your DUPR account first.');
  }

  // 2. First attempt
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${user.dupr.userToken}`);
  headers.set('Content-Type', 'application/json');
  headers.set('accept', 'application/json');

  let response = await fetch(url, { ...options, headers });

  // 3. On 401, refresh and retry
  if (response.status === 401) {
    console.log(`[DUPR User Auth] Token expired for user ${userId}, refreshing...`);

    const newToken = await refreshDuprUserToken(userId);

    headers.set('Authorization', `Bearer ${newToken}`);
    response = await fetch(url, { ...options, headers });
  }

  return response;
}