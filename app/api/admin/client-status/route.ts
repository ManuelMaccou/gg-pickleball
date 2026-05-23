// app/api/admin/client-status/route.ts
//
// Returns all clients with their current setup status in a single call.
// Used by the GG admin config page to show a status overview per client.

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import Admin from '@/app/models/Admin';
import User from '@/app/models/User';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    // Fetch all clients.
    const clients = await Client.find({})
      .select('_id name icon retailSoftware shopify')
      .lean();

    const clientIds = clients.map((c) => c._id);

    // Parallel lookups across two collections.
    const [rewardConfigs, admins] = await Promise.all([
      // Which clients have at least one reward configured.
      // SourceRewardConfig links to dataSourceId not clientId directly,
      // so we check sponsorships array for any of these clientIds.
      SourceRewardConfig.find({
        'sponsorships.sponsoringClientId': { $in: clientIds },
      })
        .select('sponsorships.sponsoringClientId')
        .lean(),

      // Which clients have an admin with a claimed account.
      Admin.find({ location: { $in: clientIds } })
        .select('location user')
        .lean(),
    ]);

    // Build lookup sets for O(1) access.
    const rewardsClientIds = new Set(
      rewardConfigs.flatMap((rc) =>
        rc.sponsorships.map((s: any) => s.sponsoringClientId.toString())
      )
    );

    // For account claimed: get user IDs from admins, then check User.accountClaimed.
    const adminUserIds = admins.map((a) => a.user);
    const claimedUsers = await User.find({
      _id: { $in: adminUserIds },
      accountClaimed: true,
    })
      .select('_id')
      .lean() as { _id: mongoose.Types.ObjectId }[];

    const claimedUserIds = new Set(claimedUsers.map((u) => u._id.toString()));

    // Map admin records to clientId → accountClaimed.
    const clientAccountClaimedMap = new Map<string, boolean>();
    for (const admin of admins) {
      const clientKey = admin.location.toString();
      const isClaimed = claimedUserIds.has(admin.user.toString());
      // If any admin for this client has claimed, mark as claimed.
      if (isClaimed) clientAccountClaimedMap.set(clientKey, true);
      else if (!clientAccountClaimedMap.has(clientKey)) {
        clientAccountClaimedMap.set(clientKey, false);
      }
    }

    // Stitch everything together.
    const clientsWithStatus = clients.map((c: any) => {
      const id = c._id.toString();
      return {
        _id: id,
        name: c.name,
        icon: c.icon,
        status: {
          shopifyConnected: !!(c.retailSoftware === 'shopify' && c.shopify?.accessToken),
          hasRewards: rewardsClientIds.has(id),
          accountClaimed: clientAccountClaimedMap.get(id) ?? false,
        },
      };
    });

    return NextResponse.json({ clients: clientsWithStatus });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/admin/client-status' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}