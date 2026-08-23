// Destination: app/api/admin/age-review/[userId]/clear/route.ts
//
// [Reversed from the original version of this file] That version
// deliberately did NOT cache a PlayerAgeVerification record from a manual
// clearance, reasoning that a human's judgment wasn't the same kind of
// confirmed signal as the DUPR-API path, and caching it risked incorrectly
// pre-clearing this DUPR ID for someone else. That risk isn't real: the
// only way anyone else could ever connect this same DUPR ID is by passing
// DUPR's own OAuth login for that specific profile — which is already
// treated everywhere else in this system as the actual gatekeeper for
// identity. Passing it means it's the same real person, regardless of
// which GG account they're doing it through.
//
// Without this fix, clearing the flag here only ever reset it to false —
// the NEXT check-eligibility click (or Connect DUPR) would just re-run the
// same live DUPR API call, get the same 'unknown' result, and flip
// pendingAgeReview back to true. Endless loop, found via testing.
//
// The fix: a manual admin confirmation is just a third SOURCE for the
// same underlying fact PlayerAgeVerification already exists to record
// permanently. checkPlayerAgeEligibility.ts already checks this registry
// first, unconditionally, before ever touching the live API — so writing
// here needs zero changes to that logic to take effect.

import { NextRequest, NextResponse } from 'next/server';
import { startSession } from 'mongoose';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import PlayerAgeVerification from '@/app/models/PlayerAgeVerification';
import { logError } from '@/lib/sentry/logger';

interface Params {
  params: Promise<{ userId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser?.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await connectToDatabase();

  const { userId } = await params;

  const session = await startSession();
  try {
    session.startTransaction();

    const target = await User.findOne({ _id: userId, pendingAgeReview: true }).session(session);
    if (!target) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'Account not found, or was not flagged.' },
        { status: 404 }
      );
    }

    const duprId = target.dupr?.id;

    await User.updateOne(
      { _id: userId },
      {
        $set: { pendingAgeReview: false },
        $unset: { pendingAgeReviewReason: '', pendingAgeReviewAt: '' },
      },
      { session }
    );

    // Upsert + $setOnInsert — same pattern used everywhere else this
    // registry gets written to. Safe if a record somehow already exists
    // (duprId is unique); never overwrites an existing confirmation.
    if (duprId) {
      await PlayerAgeVerification.updateOne(
        { duprId },
        {
          $setOnInsert: {
            duprId,
            source: 'manual_admin_review',
            confirmedBy: authorizedUser.id,
            confirmedAt: new Date(),
          },
        },
        { upsert: true, session }
      );
    } else {
      // Shouldn't happen — a flagged account only ever gets flagged as
      // part of a DUPR-connect flow, so dupr.id should always be present.
      // Flagging defensively rather than silently proceeding.
      console.warn(`[Age Review] Cleared flag for user ${userId} with no dupr.id on file — registry not updated.`);
    }

    await session.commitTransaction();

    return NextResponse.json({ cleared: true, userId });
  } catch (err) {
    await session.abortTransaction();
    const errorId = logError(err, { endpoint: 'POST /api/admin/age-review/[userId]/clear', userId });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  } finally {
    session.endSession();
  }
}