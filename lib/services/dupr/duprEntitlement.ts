// lib/services/dupr/duprEntitlement.ts
//
// Reusable entitlement check for any DUPR action.
// Verifies the user has a given entitlement (BASIC_L1 by default), caches all
// known entitlements for 24 hours on the user document.
// Auto-refreshes expired tokens via authenticatedDuprUserFetch.

import User from '@/app/models/User';
import { authenticatedDuprUserFetch } from './duprUserAuth';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export type DuprEntitlement = 'BASIC_L1' | 'PREMIUM_L1' | 'VERIFIED_L1';

type EntitlementFlags = {
  hasBasicEntitlement: boolean;
  hasPremiumEntitlement: boolean;
  hasVerifiedEntitlement: boolean;
};

type EntitlementResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

// Returned by checkEntitlementsWithToken so callers can act on all three flags.
export type EntitlementFlagsResult =
  | { ok: true; flags: EntitlementFlags }
  | { ok: false; error: string; status: number };

const ENTITLEMENT_FIELD_MAP: Record<DuprEntitlement, keyof EntitlementFlags> = {
  BASIC_L1: 'hasBasicEntitlement',
  PREMIUM_L1: 'hasPremiumEntitlement',
  VERIFIED_L1: 'hasVerifiedEntitlement',
};

const ENTITLEMENT_DENIED_MESSAGE: Record<DuprEntitlement, string> = {
  BASIC_L1:
    'You do not have the required DUPR subscription. Please contact DUPR support.',
  PREMIUM_L1:
    'This action requires a DUPR+ subscription. Please upgrade your DUPR account to continue.',
  VERIFIED_L1:
    'This action requires a verified DUPR account. Please verify your DUPR account to continue.',
};

/**
 * Parses raw subscription response data into EntitlementFlags.
 * Unions all tournament entitlements across every subscription on the account.
 * Shared by both the token-based and user-based check paths.
 */
function parseEntitlementFlags(data: unknown): EntitlementFlags {
  const tournamentEntitlements = new Set<string>();
  const subscriptions = (data as any)?.subscriptions;
  if (Array.isArray(subscriptions)) {
    for (const sub of subscriptions) {
      const tournaments = sub?.entitlements?.tournaments;

      console.log('entitlements:', tournaments)

      if (Array.isArray(tournaments)) {
        for (const t of tournaments) {
          if (typeof t === 'string') tournamentEntitlements.add(t);
        }
      }
    }
  }
  return {
    hasBasicEntitlement: tournamentEntitlements.has('BASIC_L1'),
    hasPremiumEntitlement: tournamentEntitlements.has('PREMIUM_L1'),
    hasVerifiedEntitlement: tournamentEntitlements.has('VERIFIED_L1'),
  };
}

/**
 * Checks all three DUPR entitlements using a raw bearer token.
 * Use this when the token has not yet been saved to the database — specifically
 * during PATCH /api/user when a user first connects their DUPR account.
 *
 * Returns all three flags so the caller can include them in the same DB write
 * as the token save, populating entitlements atomically on first connect.
 *
 * Does NOT write to the database — the caller is responsible for persisting
 * the returned flags alongside the token.
 */
export async function checkEntitlementsWithToken(
  rawToken: string
): Promise<EntitlementFlagsResult> {
  const DUPR_BACKEND_API_BASE_URL = process.env.DUPR_BACKEND_API_BASE_URL;
  if (!DUPR_BACKEND_API_BASE_URL) {
    console.error('[DUPR Entitlement] Missing DUPR_BACKEND_API_BASE_URL env var');
    return { ok: false, error: 'DUPR configuration error.', status: 500 };
  }

  try {
    const response = await fetch(
      `https://${DUPR_BACKEND_API_BASE_URL}/subscription/active`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DUPR Entitlement] Token-based check failed (${response.status}):`, errText);
      return {
        ok: false,
        error: 'Failed to verify your DUPR subscription. Please try again later.',
        status: 502,
      };
    }

    const data = await response.json();

    console.log('entitlement data;', data);

    const flags = parseEntitlementFlags(data);

    console.log('[DUPR Entitlement] Token-based check result:', flags);
    return { ok: true, flags };
  } catch (err) {
    console.error('[DUPR Entitlement] Token-based check threw:', err);
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to verify your DUPR account status.';
    return { ok: false, error: message, status: 500 };
  }
}

/**
 * Hits DUPR's /subscription/active endpoint using the user's saved token,
 * parses out all three entitlement flags, and writes them to the user doc.
 * Returns the freshly fetched flags.
 */
async function refreshEntitlementsFromDupr(
  userId: string
): Promise<EntitlementFlags | { error: string; status: number }> {
  const DUPR_BACKEND_API_BASE_URL = process.env.DUPR_BACKEND_API_BASE_URL;
  if (!DUPR_BACKEND_API_BASE_URL) {
    console.error('[DUPR Entitlement] Missing DUPR_BACKEND_API_BASE_URL env var');
    return { error: 'DUPR configuration error.', status: 500 };
  }

  let response: Response;
  try {
    response = await authenticatedDuprUserFetch(
      userId,
      `https://${DUPR_BACKEND_API_BASE_URL}/subscription/active`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  } catch (err) {
    console.error('[DUPR Entitlement] Fetch failed:', err);
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to verify your DUPR account status.';
    return {
      error: message,
      status: message.includes('reconnect') ? 401 : 500,
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[DUPR Entitlement] API failed (${response.status}):`, errText);
    return {
      error: 'Failed to verify your DUPR subscription. Please try again later.',
      status: 502,
    };
  }

  const data = await response.json();

  console.log('entitlment data:', data)

  const flags = parseEntitlementFlags(data);

  // Always cache the result of a successful API call, regardless of which
  // entitlements came back. The cache means "we asked DUPR recently," not
  // "the user is entitled" — so we don't keep hammering DUPR for non-entitled
  // users on every request.
  await User.findByIdAndUpdate(userId, {
    $set: {
      'dupr.hasBasicEntitlement': flags.hasBasicEntitlement,
      'dupr.hasPremiumEntitlement': flags.hasPremiumEntitlement,
      'dupr.hasVerifiedEntitlement': flags.hasVerifiedEntitlement,
      'dupr.entitlementCheckedAt': new Date(),
    },
  });

  console.log(`[DUPR Entitlement] User ${userId} refreshed:`, flags);
  return flags;
}

/**
 * Verifies a user has a given DUPR entitlement.
 * Defaults to BASIC_L1 for backward compatibility with existing call sites.
 *
 * Uses 24-hour cache on the user document to avoid redundant API calls.
 * Auto-refreshes expired tokens.
 */
export async function verifyDuprEntitlement(
  userId: string,
  entitlement: DuprEntitlement = 'BASIC_L1'
): Promise<EntitlementResult> {
  const user = (await User.findById(userId)
    .select('dupr')
    .lean()) as {
    dupr?: {
      userToken?: string;
      entitlementCheckedAt?: Date;
      hasBasicEntitlement?: boolean;
      hasPremiumEntitlement?: boolean;
      hasVerifiedEntitlement?: boolean;
    };
  } | null;

  if (!user?.dupr?.userToken) {
    return {
      ok: false,
      error: 'Your DUPR account is not connected. Please connect your DUPR account first.',
      status: 403,
    };
  }

  const fieldName = ENTITLEMENT_FIELD_MAP[entitlement];

  // Cache hit — read the requested entitlement off the user doc.
  if (user.dupr.entitlementCheckedAt) {
    const lastCheck = new Date(user.dupr.entitlementCheckedAt).getTime();
    if (Date.now() - lastCheck < TWENTY_FOUR_HOURS) {
      if (user.dupr[fieldName]) {
        return { ok: true };
      }
      return {
        ok: false,
        error: ENTITLEMENT_DENIED_MESSAGE[entitlement],
        status: 403,
      };
    }
  }

  // Cache stale or never set — refresh from DUPR.
  const refreshed = await refreshEntitlementsFromDupr(userId);

  if ('error' in refreshed) {
    return { ok: false, error: refreshed.error, status: refreshed.status };
  }

  if (refreshed[fieldName]) {
    return { ok: true };
  }

  console.warn(
    `[DUPR Entitlement] User ${userId} missing ${entitlement} entitlement.`
  );
  return {
    ok: false,
    error: ENTITLEMENT_DENIED_MESSAGE[entitlement],
    status: 403,
  };
}

/**
 * Forces a fresh entitlement check from DUPR, bypassing the 24-hour cache.
 * Use after the user may have changed their subscription status (e.g. upgraded
 * to DUPR+ inside the SSO iframe after connecting).
 *
 * Writes the refreshed flags + timestamp to the user doc.
 */
export async function forceRefreshDuprEntitlements(
  userId: string
): Promise<EntitlementFlags | { error: string; status: number }> {
  // Confirm the user has DUPR connected before hitting the endpoint.
  const user = (await User.findById(userId)
    .select('dupr.userToken')
    .lean()) as { dupr?: { userToken?: string } } | null;
 
  if (!user?.dupr?.userToken) {
    return {
      error: 'Your DUPR account is not connected.',
      status: 403,
    };
  }
 
  return refreshEntitlementsFromDupr(userId);
}