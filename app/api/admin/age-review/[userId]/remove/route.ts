// Destination: app/api/admin/age-review/[userId]/remove/route.ts
//
// Confirmed removal = full deletion, per the requirements doc Section 8
// item 5 — not just scrubbing PII while leaving a stub. Three things have
// to happen together, transactionally, so a partial failure can't leave
// the database in a half-deleted state:
//   1. Delete any RewardCode docs referencing this user.
//   2. Scrub this user's ObjectId out of every Match array it appears in
//      (team1.players, team2.players, winners, processedUsers) — this is
//      what keeps "doesn't affect match data" true. Without it, a match
//      would be left with a dangling reference in an array — the score
//      and raw DUPR IDs stay completely intact either way, but the
//      resolved-player list needs to go back to looking exactly like it
//      does for anyone who was never resolved in the first place.
//   3. Delete the User document itself.
//
// NOT included: deleting the corresponding Auth0 identity. This route
// only touches MongoDB. If "full deletion" should also mean the person's
// Auth0 login credential (email/password) stops existing entirely, that's
// a separate call against Auth0's Management API that isn't wired in here
// — worth a explicit decision, not assumed either way.
//
// PlayerIdentityIssue.implicatedUserIds is NOT scrubbed here — a
// self-serve-created account (which is the only kind that can ever be
// flagged this way) cannot structurally have been implicated in an
// identity conflict, since that system is only ever populated by Players
// Upload, which no longer runs. Not a gap, just not applicable to this
// population.

import { NextRequest, NextResponse } from 'next/server';
import { startSession } from 'mongoose';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import RewardCode from '@/app/models/RewardCode';
import Match from '@/app/models/Match';
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

  // Safety check — must still be flagged at the moment of deletion, same
  // reasoning as the clear route. Guards against acting on stale UI state
  // (e.g. a double-click, or the flag having already been cleared in
  // another tab).
  const targetUser = await User.findOne({ _id: userId, pendingAgeReview: true });
  if (!targetUser) {
    return NextResponse.json(
      { error: 'Account not found, or is not currently flagged.' },
      { status: 404 }
    );
  }

  const session = await startSession();

  try {
    session.startTransaction();

    const deletedRewardCodes = await RewardCode.deleteMany({ userId }, { session });

    await Match.updateMany(
      {
        $or: [
          { 'team1.players': userId },
          { 'team2.players': userId },
          { winners: userId },
          { processedUsers: userId },
        ],
      },
      {
        $pull: {
          'team1.players': userId,
          'team2.players': userId,
          winners: userId,
          processedUsers: userId,
        },
      },
      { session }
    );

    await User.deleteOne({ _id: userId }, { session });

    await session.commitTransaction();

    console.log(
      `[Age Review] Removed user ${userId} — deleted ${deletedRewardCodes.deletedCount} reward code(s), ` +
      `scrubbed from all Match references.`
    );

    return NextResponse.json({
      removed: true,
      userId,
      rewardCodesDeleted: deletedRewardCodes.deletedCount,
    });
  } catch (err) {
    await session.abortTransaction();
    const errorId = logError(err, {
      endpoint: 'POST /api/admin/age-review/[userId]/remove',
      userId,
    });
    return NextResponse.json({ errorId, error: 'Internal error — nothing was deleted.' }, { status: 500 });
  } finally {
    session.endSession();
  }
}