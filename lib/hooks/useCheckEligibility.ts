'use client';

// Destination: lib/hooks/useCheckEligibility.ts
//
// Extracted from TournamentEligibilityGrid.tsx — that component is now
// superseded (delete it), since presenting this as a per-tournament-card
// action implied scoping that was never real: /api/player/check-eligibility
// checks a player's DUPR ID against every match in the last 6 months,
// full stop, regardless of which "tournament" a button happened to sit
// under. Moving the action to the hero as a single, clearly-global button
// matches what it actually does. This hook holds the API call + state so
// the presentational piece (CheckEligibilityButton) stays small.

import { useState } from 'react';
import { FrontendUser } from '@/app/types/frontendTypes';

export type CheckEligibilityResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; matchesFound: number; matchesProcessed: number }
  | { status: 'blocked' }
  | { status: 'error'; message: string };

export function useCheckEligibility(
  dbUser: FrontendUser | null,
  onInitiateDuprLogin: () => void,
  onRewardsMayHaveChanged?: () => void
) {
  const [result, setResult] = useState<CheckEligibilityResult>({ status: 'idle' });

  const isLoggedIn = !!dbUser;
  // Checks userToken specifically, not just dupr.id — dupr.id alone can be
  // set by CSV reconciliation without real OAuth ever happening, but the
  // backend's DUPR API fallback needs an actual stored token to
  // authenticate with.
  const hasDupr = !!dbUser?.dupr?.userToken;

  const handleCheckEligibility = async () => {
    if (!isLoggedIn) {
      window.location.href = '/auth/login?returnTo=/play';
      return;
    }

    if (!hasDupr) {
      onInitiateDuprLogin();
      return;
    }

    setResult({ status: 'loading' });
    try {
      const res = await fetch('/api/player/check-eligibility', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setResult({ status: 'error', message: data.error || 'Something went wrong.' });
        return;
      }

      if (data.blocked) {
        setResult({ status: 'blocked' });
        return;
      }

      setResult({
        status: 'success',
        matchesFound: data.matchesFound ?? 0,
        matchesProcessed: data.matchesProcessed ?? 0,
      });

      if ((data.matchesProcessed ?? 0) > 0) {
        onRewardsMayHaveChanged?.();
      }
    } catch (err) {
      console.error('[useCheckEligibility] Check failed:', err);
      setResult({ status: 'error', message: 'Something went wrong. Please try again.' });
    }
  };

  const buttonLabel = !isLoggedIn
    ? 'Log in to check eligibility'
    : !hasDupr
    ? 'Connect DUPR to check eligibility'
    : result.status === 'loading'
    ? 'Checking…'
    : 'Check reward eligibility';

  return { result, buttonLabel, handleCheckEligibility, isLoggedIn, hasDupr };
}