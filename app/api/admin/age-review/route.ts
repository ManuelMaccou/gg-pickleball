// Destination: app/api/admin/age-review/route.ts
//
// Lists every account with pendingAgeReview: true, alongside how many
// RewardCode documents reference them — should normally be zero, since
// rewards are blocked from the moment the flag is set (once
// check-eligibility respects it — see the requirements doc, Section 12,
// item 4), but surfaced explicitly as a safety check before any deletion
// decision, per Section 8.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import RewardCode from '@/app/models/RewardCode';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (!authorizedUser?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const flaggedUsers = await User.find({ pendingAgeReview: true })
      .select('name email dupr.id dupr.rating pendingAgeReviewReason pendingAgeReviewAt createdAt')
      .sort({ pendingAgeReviewAt: -1 })
      .lean();

    if (flaggedUsers.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const userIds = flaggedUsers.map((u) => u._id);

    const rewardCounts = await RewardCode.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(rewardCounts.map((r) => [r._id.toString(), r.count]));

    const accounts = flaggedUsers.map((u) => ({
      ...u,
      rewardCodeCount: countMap.get(u._id.toString()) ?? 0,
    }));

    return NextResponse.json({ accounts });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/admin/age-review' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}