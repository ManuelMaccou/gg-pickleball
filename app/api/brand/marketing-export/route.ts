// app/api/brand/marketing-export/route.ts
//
// Returns a list of players who have:
//   1. Earned a reward from this brand (have a RewardCode for this clientId)
//   2. Opted into brand communications (brandOptin: true on their User record)
//
// Used by the brand dashboard to export a marketing CSV.
// Deduplicates by userId so each player appears once even if they earned
// multiple rewards.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import RewardCode from '@/app/models/RewardCode';
import User from '@/app/models/User';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    await connectToDatabase();

    // Find all reward codes issued by this brand
    const rewardCodes = await RewardCode.find({ clientId: user.adminLocationId })
      .select('userId')
      .lean() as any[];

    if (rewardCodes.length === 0) {
      return NextResponse.json({ players: [] });
    }

    // Deduplicate userIds — each player appears once
    const userIdSet = new Set<string>(rewardCodes.map(r => r.userId.toString()));
    const userIds = Array.from(userIdSet);

    // Find opted-in users among those players
    const optedInUsers = await User.find({
      _id: { $in: userIds },
      brandOptin: true,
    }).select('_id name email').lean() as any[];

    const optedInUserMap = new Map(optedInUsers.map(u => [u._id.toString(), u]));

    // Build export — deduplicate by email, one row per unique player
    const seenEmails = new Set<string>();
    const rows: { email: string }[] = [];

    for (const code of rewardCodes) {
      const userId = code.userId.toString();
      const player = optedInUserMap.get(userId);
      if (!player || !player.email) continue;
      if (seenEmails.has(player.email)) continue;
      seenEmails.add(player.email);
      rows.push({ email: player.email });
    }

    return NextResponse.json({ players: rows, total: rows.length });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/brand/marketing-export' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}