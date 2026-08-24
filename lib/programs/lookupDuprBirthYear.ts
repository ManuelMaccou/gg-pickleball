// Destination: lib/programs/lookupDuprBirthYear.ts
//
// [Real DUPR integration] Replaces the earlier placeholder entirely. Uses
// authenticatedDuprUserFetch (lib/services/dupr/duprUserAuth.ts) — the
// specific player's OWN stored OAuth token, not a generic app-level one —
// against /public/user/info, which returns whichever PII that person has
// consented to share, including their own duprId and birthYear. Identity
// comes from token possession, not from us verifying an ID against the
// response — there's no "look up an arbitrary stranger's DUPR ID" step
// needed at all, which is what made the earlier placeholder's missing-
// DUPR-ID problem moot rather than something to solve.
//
// Signature change from the earlier placeholder: takes the MongoDB
// userId now, not the duprId string — authenticatedDuprUserFetch needs
// the user's own stored token, which is looked up by userId. Callers
// updated accordingly (checkPlayerAgeEligibility.ts, and its own caller
// in check-eligibility/route.ts).
//
// authenticatedDuprUserFetch already throws if dupr.userToken is missing
// (no OAuth connection yet) — caught below and treated as 'unknown', same
// as any other failure. No special-casing needed for that case.

import { authenticatedDuprUserFetch } from '@/lib/services/dupr/duprUserAuth';

export type DuprBirthYearResult =
  | { status: 'confirmed_13_plus'; birthYear: number }
  | { status: 'confirmed_under_13'; birthYear: number }
  | { status: 'unknown' }; // no birth year on file, no OAuth connection, or the lookup failed

const MINIMUM_AGE = 13;
const DUPR_BACKEND_API_BASE_URL = process.env.DUPR_BACKEND_API_BASE_URL;

// [Test override] Lets a specific MongoDB userId return a forced result
// without calling the real DUPR API — for testing the age-verification
// flow end to end (Connect DUPR -> pendingAgeReview -> Age Review admin
// page) without needing a real DUPR profile with a controllable birth
// year. Keyed by userId, not duprId, since that's the only identifier
// this function actually receives.
//
// Format: DUPR_AGE_TEST_OVERRIDES="<userId>:<birthYear>,<userId>:<birthYear>"
//   e.g. "6a83f55c221d2a1a6c4206d7:2015" simulates that user having a 2015
//   birth year (confirmed_under_13 as of 2026). Leave the year blank
//   ("<userId>:") to simulate 'unknown' — no birth year returned at all.
//
// STRUCTURALLY CANNOT ACTIVATE IN PRODUCTION — checked below regardless of
// whether the env var is accidentally left set. This gates child-safety
// logic; the guard is deliberately redundant with "just don't set it in
// prod" rather than relying on that alone.
function getTestOverride(userId: string): DuprBirthYearResult | undefined {
  const raw = process.env.DUPR_AGE_TEST_OVERRIDES;
  if (!raw) return undefined;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[DuprBirthYearLookup] DUPR_AGE_TEST_OVERRIDES is set in production — ignoring it entirely. ' +
      'This must never be set outside local/test environments.'
    );
    return undefined;
  }

  const pairs = raw.split(',').map((p) => p.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [id, yearStr] = pair.split(':').map((s) => s.trim());
    if (id !== userId) continue;

    if (!yearStr) {
      return { status: 'unknown' };
    }
    const birthYear = Number(yearStr);
    if (!Number.isFinite(birthYear)) return { status: 'unknown' };

    const currentYear = new Date().getFullYear();
    const approximateAge = currentYear - birthYear;
    return approximateAge >= MINIMUM_AGE
      ? { status: 'confirmed_13_plus', birthYear }
      : { status: 'confirmed_under_13', birthYear };
  }

  return undefined;
}

export async function lookupDuprBirthYear(userId: string): Promise<DuprBirthYearResult> {
  console.log(`[DuprBirthYearLookup] Starting lookup for userId: ${userId}`);

  const override = getTestOverride(userId);
  if (override) {
    console.log(`[DuprBirthYearLookup] TEST OVERRIDE active for userId ${userId}: ${JSON.stringify(override)}`);
    return override;
  }

  try {
    if (!DUPR_BACKEND_API_BASE_URL) {
      console.log('[DuprBirthYearLookup] Missing DUPR_BACKEND_API_BASE_URL env var. Returning \'unknown\'.');
      return { status: 'unknown' };
    }

    const url = `https://${DUPR_BACKEND_API_BASE_URL}/public/user/info`;
    console.log(`[DuprBirthYearLookup] GET ${url} (as user ${userId})`);

    const res = await authenticatedDuprUserFetch(userId, url, { method: 'GET' });

    console.log(`[DuprBirthYearLookup] Response status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text().catch(() => '(could not read response body)');
      console.log(`[DuprBirthYearLookup] Non-OK response body: ${text}`);
      return { status: 'unknown' };
    }

    const data = await res.json();
    console.log(`[DuprBirthYearLookup] Response body: ${JSON.stringify(data)}`);

    // Per the docs: in-handler failures (can't resolve user, can't fetch
    // consent) come back as HTTP 200 with status: 'FAILURE' in the body —
    // NOT a non-200 status. Real 401s come from the security filter and
    // never reach here at all, so this is the only failure signal to
    // check once res.ok is true.
    if (data.status === 'FAILURE') {
      console.log('[DuprBirthYearLookup] status: FAILURE in response body — returning \'unknown\'.');
      return { status: 'unknown' };
    }

    const result = data?.results?.[0];
    const birthYear: number | undefined = result?.birthYear;
    console.log(`[DuprBirthYearLookup] Extracted birthYear: ${birthYear} (duprId in response: ${result?.duprId})`);

    if (!birthYear || typeof birthYear !== 'number') {
      console.log('[DuprBirthYearLookup] No usable birthYear on the response — returning \'unknown\'.');
      return { status: 'unknown' };
    }

    const currentYear = new Date().getFullYear();
    const approximateAge = currentYear - birthYear;
    console.log(`[DuprBirthYearLookup] currentYear: ${currentYear}, approximateAge: ${approximateAge}, threshold: ${MINIMUM_AGE}`);

    if (approximateAge >= MINIMUM_AGE) {
      console.log('[DuprBirthYearLookup] Result: confirmed_13_plus');
      return { status: 'confirmed_13_plus', birthYear };
    }

    console.log('[DuprBirthYearLookup] Result: confirmed_under_13');
    return { status: 'confirmed_under_13', birthYear };
  } catch (err) {
    // Includes authenticatedDuprUserFetch's own thrown errors — e.g. "DUPR
    // account not connected" if dupr.userToken is missing, or "session
    // expired" if refresh also failed. All treated as 'unknown' — we
    // simply couldn't verify, not a confirmed answer either way.
    console.error('[DuprBirthYearLookup] Lookup threw an exception:', err);
    return { status: 'unknown' };
  }
}