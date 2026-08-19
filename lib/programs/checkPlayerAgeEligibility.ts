// Destination: lib/programs/checkPlayerAgeEligibility.ts
//
// [Eligibility check] Checks the registry ONLY — never account existence.
// A CSV-sourced account always has a matching registry record (written in
// the same transaction that created the account, see
// processPlayersUpload.ts), so checking the registry alone correctly
// covers that population too, with one rule instead of two. This is what
// makes self-serve signup safe: a freshly-signed-up account proves
// nothing about age on its own, so there's nothing to shortcut on for
// that population — the registry (or the DUPR API fallback) is the only
// source of truth, unconditionally.
//
// [Real DUPR integration] Signature now takes userId alongside duprId —
// lookupDuprBirthYear needs it to authenticate as that specific player via
// their own stored OAuth token (authenticatedDuprUserFetch), not a generic
// app-level credential. duprId is still what the registry itself is keyed
// on, unchanged.
//
// [Logging] Prefixed [AgeCheck] so it's easy to distinguish from the
// calling route's own [CheckEligibility] logs in a combined trace.

import { ClientSession } from 'mongoose';
import PlayerAgeVerification from '@/app/models/PlayerAgeVerification';
import { lookupDuprBirthYear } from './lookupDuprBirthYear';

export type AgeEligibilityResult =
  | { eligible: true; source: 'registry' | 'dupr_api' }
  | { eligible: false; reason: 'confirmed_under_13' | 'unknown' };

export async function checkPlayerAgeEligibility(
  duprId: string,
  userId: string,
  session: ClientSession
): Promise<AgeEligibilityResult> {
  console.log(`[AgeCheck] Checking registry for duprId: ${duprId}`);

  const existing = await PlayerAgeVerification.findOne({ duprId }).session(session);
  if (existing) {
    console.log(
      `[AgeCheck] Registry HIT — source: ${existing.source}, confirmedAt: ${existing.confirmedAt?.toISOString()}` +
      (existing.programId ? `, programId: ${existing.programId.toString()}` : '')
    );
    return { eligible: true, source: 'registry' };
  }

  console.log('[AgeCheck] Registry MISS — falling back to DUPR API lookup (as this player, via their own OAuth token).');

  // Not in the registry — never confirmed 13+ via any Players Upload
  // roster. Fall back to DUPR's own records, authenticated as this
  // specific player.
  const duprResult = await lookupDuprBirthYear(userId);
  console.log(`[AgeCheck] DUPR API lookup result: ${JSON.stringify(duprResult)}`);

  if (duprResult.status === 'confirmed_13_plus') {
    console.log(`[AgeCheck] Confirmed 13+ (birthYear: ${duprResult.birthYear}) — caching new registry record.`);
    // Cache this so future checks never need to hit the DUPR API again
    // for this DUPR ID — same "record it once, age only ever increases"
    // reasoning as the players_upload-sourced records.
    await PlayerAgeVerification.create(
      [{
        duprId,
        birthYear: duprResult.birthYear,
        source: 'dupr_api',
        confirmedAt: new Date(),
      }],
      { session }
    );
    console.log('[AgeCheck] Registry record cached — ELIGIBLE (source: dupr_api)');
    return { eligible: true, source: 'dupr_api' };
  }

  if (duprResult.status === 'confirmed_under_13') {
    console.log('[AgeCheck] Confirmed under 13 — BLOCKED. Deliberately NOT cached (no identifying data retained).');
    // Deliberately NOT cached — per the original COPPA design, no
    // identifying data is retained for a confirmed-under-13 person, not
    // even a bare "not eligible" marker tied to their DUPR ID.
    return { eligible: false, reason: 'confirmed_under_13' };
  }

  // status === 'unknown' — DUPR has no birth year on file, no OAuth
  // connection to authenticate with, or the lookup itself failed. Treated
  // the same as confirmed-under-13: blocked, not assumed innocent,
  // matching the earlier decision that indeterminate age data doesn't get
  // the benefit of the doubt.
  console.log('[AgeCheck] Status unknown (no birth year on file, no DUPR connection, or lookup failed) — BLOCKED, treated as not-innocent-until-proven.');
  return { eligible: false, reason: 'unknown' };
}