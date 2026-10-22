// Destination: lib/rewards/rewardCodeStatus.ts
//
// Single definition of "usable" for a reward code, shared by the wallet, card
// and detail view so they can't drift apart. Codes with no expiresAt (every
// code created before expiration existed, plus affiliate/generic codes) never
// expire.

type CodeLike = { redeemed: boolean; expiresAt?: Date | string | null };

export const isCodeExpired = (c: { expiresAt?: Date | string | null }, now = Date.now()): boolean =>
  !!c.expiresAt && new Date(c.expiresAt).getTime() <= now;

export const isCodeUsable = (c: CodeLike, now = Date.now()): boolean =>
  !c.redeemed && !isCodeExpired(c, now);

export const formatExpiry = (d: Date | string): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Soonest expiry among a set of usable codes, or null if none expire.
export const soonestExpiry = (codes: CodeLike[]): Date | null => {
  const times = codes.filter(c => c.expiresAt).map(c => new Date(c.expiresAt!).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
};