// Destination: lib/programs/reconcilePlayerIdentity.ts
//
// The single source of truth for "given this email and this DUPR ID, is
// there a coherent existing account, or not." Called from two places:
//   1. Players Upload row processing (raw CSV row in)
//   2. The identity-issue resolve dialog's Confirm action (admin-edited
//      fields in)
// Both calls produce the same shape of result, and both treat 'conflict'
// the same way — create/refresh a PlayerIdentityIssue, don't create or
// modify any User. This function has no knowledge of CSVs, dialogs, or
// issues — it only answers the identity question.

import { ClientSession } from 'mongoose';
import User from '@/app/models/User';

export type ReconciliationResult =
  | { outcome: 'create_new' }
  | { outcome: 'match_existing'; userId: string; backfillDuprId: boolean }
  | {
      outcome: 'conflict';
      conflictType: 'email_matches_dupr_conflict' | 'dupr_matches_email_conflict' | 'cross_match_conflict';
      implicatedUserIds: string[];
    };

export async function reconcilePlayerIdentity(
  email: string,
  duprId: string,
  session: ClientSession
): Promise<ReconciliationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDuprId = duprId.trim();

  const emailHolder = await User.findOne({ email: normalizedEmail }).session(session);
  const duprHolder = await User.findOne({ 'dupr.id': normalizedDuprId }).session(session);

  // Neither exists — clean slate, safe to create a brand-new account.
  if (!emailHolder && !duprHolder) {
    return { outcome: 'create_new' };
  }

  // Both exist and are the SAME account — clean match. Backfill the DUPR
  // ID only if that account didn't already have one; if it did and it
  // already equals normalizedDuprId, there's nothing to write.
  if (emailHolder && duprHolder && emailHolder._id.toString() === duprHolder._id.toString()) {
    return {
      outcome: 'match_existing',
      userId: emailHolder._id.toString(),
      backfillDuprId: !emailHolder.dupr?.id,
    };
  }

  // Both exist but point at TWO DIFFERENT accounts — implicates both.
  if (emailHolder && duprHolder) {
    return {
      outcome: 'conflict',
      conflictType: 'cross_match_conflict',
      implicatedUserIds: [emailHolder._id.toString(), duprHolder._id.toString()],
    };
  }

  // Only the email holder exists — the DUPR ID doesn't match what's on
  // that account (missing entirely, or a different value).
  if (emailHolder) {
    return {
      outcome: 'conflict',
      conflictType: 'email_matches_dupr_conflict',
      implicatedUserIds: [emailHolder._id.toString()],
    };
  }

  // Only the DUPR holder exists — the email doesn't match what's on that
  // account.
  return {
    outcome: 'conflict',
    conflictType: 'dupr_matches_email_conflict',
    implicatedUserIds: [duprHolder!._id.toString()],
  };
}