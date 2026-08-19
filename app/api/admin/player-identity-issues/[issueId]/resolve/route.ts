// Destination: app/api/admin/player-identity-issues/[issueId]/resolve/route.ts
//
// Runs the EXACT SAME reconciliation check that ran during original CSV
// processing — no case-specific branching here at all. Success only ever
// means: both submitted fields match nothing (new account created), or
// both match the exact same existing account (linked, DUPR ID backfilled
// if it was missing). Anything else fails, the issue stays open untouched,
// and the dialog gets back what actually conflicted this time.

import { NextRequest, NextResponse } from 'next/server';
import { startSession, ClientSession } from 'mongoose';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import PlayerIdentityIssue from '@/app/models/PlayerIdentityIssue';
import { reconcilePlayerIdentity } from '@/lib/programs/reconcilePlayerIdentity';
import { findOrCreatePlayerAccount } from '@/lib/programs/findOrCreatePlayerAccount';
import { logError } from '@/lib/sentry/logger';

interface Params {
  params: Promise<{ issueId: string }>;
}

// Unflags a previously-implicated account, but only if no OTHER open issue
// still names it. An account can be implicated by more than one issue at
// once (e.g. two separate bad rows both pointed at the same person) —
// resolving one shouldn't clear a flag another still-open issue needs.
async function maybeUnflagUser(userId: string, resolvingIssueId: string, session: ClientSession) {
  const otherOpenIssue = await PlayerIdentityIssue.exists({
    _id: { $ne: resolvingIssueId },
    implicatedUserIds: userId,
    status: 'open',
  }).session(session);

  if (!otherOpenIssue) {
    await User.updateOne({ _id: userId }, { $set: { identityUnresolved: false } }, { session });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser?.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await connectToDatabase();

  const { issueId } = await params;
  const { email, duprId } = await req.json();

  if (!email?.trim() || !duprId?.trim()) {
    return NextResponse.json({ error: 'Both email and DUPR ID are required.' }, { status: 400 });
  }

  const issue = await PlayerIdentityIssue.findById(issueId);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
  }
  if (issue.status === 'resolved') {
    return NextResponse.json({ error: 'This issue has already been resolved.' }, { status: 400 });
  }

  const session = await startSession();

  try {
    session.startTransaction();

    const reconciliation = await reconcilePlayerIdentity(email, duprId, session);

    if (reconciliation.outcome === 'conflict') {
      await session.abortTransaction();

      // [Attempt log] Record what was tried and why it failed — but never
      // touch implicatedUserIds/conflictType/submittedEmail/
      // submittedDuprId. "Account X has this issue" stays a stable fact
      // regardless of how many attempts happen; this is purely a log
      // entry for context. Un-sessioned write — the transaction above was
      // already aborted and only ever did reads, nothing to roll back.
      await PlayerIdentityIssue.findByIdAndUpdate(issueId, {
        $push: {
          attempts: {
            attemptedEmail: email,
            attemptedDuprId: duprId,
            succeeded: false,
            conflictType: reconciliation.conflictType,
            conflictImplicatedUserIds: reconciliation.implicatedUserIds,
            attemptedAt: new Date(),
            attemptedBy: authorizedUser.id,
          },
        },
      });

      // Populated so the dialog can render specific context (name/email/
      // DUPR ID of whoever this attempt conflicted with) without a second
      // round-trip.
      const conflictUsers = await User.find(
        { _id: { $in: reconciliation.implicatedUserIds } },
        'name email dupr'
      ).lean();

      return NextResponse.json({
        resolved: false,
        conflictType: reconciliation.conflictType,
        implicatedUserIds: reconciliation.implicatedUserIds,
        implicatedUsers: conflictUsers,
      }, { status: 409 });
    }

    let resolvedUserId: string;

    if (reconciliation.outcome === 'create_new') {
      const result = await findOrCreatePlayerAccount(
        { duprId, name: issue.submittedName || email, email },
        { session }
      );
      resolvedUserId = result.userId;
    } else {
      // match_existing
      if (reconciliation.backfillDuprId) {
        await User.updateOne(
          { _id: reconciliation.userId },
          { $set: { 'dupr.id': duprId } },
          { session }
        );
      }
      resolvedUserId = reconciliation.userId;
    }

    // Unflag every account THIS issue originally implicated — the
    // confusion it represented is now settled for them, regardless of
    // which account (new or existing) this row actually ended up
    // resolving to.
    for (const implicatedId of issue.implicatedUserIds) {
      await maybeUnflagUser(implicatedId.toString(), issue._id.toString(), session);
    }

    issue.attempts.push({
      attemptedEmail: email,
      attemptedDuprId: duprId,
      succeeded: true,
      attemptedAt: new Date(),
      attemptedBy: authorizedUser.id,
    } as any);

    issue.status = 'resolved';
    issue.resolvedAt = new Date();
    issue.resolvedBy = authorizedUser.id as any;
    issue.resolvedEmail = email;
    issue.resolvedDuprId = duprId;
    issue.resolvedUserId = resolvedUserId as any;
    await issue.save({ session });

    await session.commitTransaction();

    return NextResponse.json({ resolved: true, userId: resolvedUserId });
  } catch (err) {
    await session.abortTransaction();
    const errorId = logError(err, {
      endpoint: 'POST /api/admin/player-identity-issues/[issueId]/resolve',
      issueId,
    });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  } finally {
    session.endSession();
  }
}