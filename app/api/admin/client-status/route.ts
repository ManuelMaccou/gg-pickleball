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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    // Include createdAt and hasActivePlan for attention flag logic
    const clients = await Client.find({})
      .select('_id name icon retailSoftware shopify createdAt active')
      .lean();

    const clientIds = clients.map((c) => c._id);

    const [rewardConfigs, admins] = await Promise.all([
      SourceRewardConfig.find({
        'sponsorships.sponsoringClientId': { $in: clientIds },
      })
        .select('sponsorships.sponsoringClientId')
        .lean(),

      Admin.find({ location: { $in: clientIds } })
        .select('location user')
        .lean(),
    ]);

    const rewardsClientIds = new Set(
      rewardConfigs.flatMap((rc) =>
        rc.sponsorships.map((s: any) => s.sponsoringClientId.toString())
      )
    );

    const adminUserIds = admins.map((a) => a.user);
    const claimedUsers = await User.find({
      _id: { $in: adminUserIds },
      accountClaimed: true,
    })
      .select('_id')
      .lean() as { _id: mongoose.Types.ObjectId }[];

    const claimedUserIds = new Set(claimedUsers.map((u) => u._id.toString()));

    const clientAccountClaimedMap = new Map<string, boolean>();
    for (const admin of admins) {
      const clientKey = admin.location.toString();
      const isClaimed = claimedUserIds.has(admin.user.toString());
      if (isClaimed) clientAccountClaimedMap.set(clientKey, true);
      else if (!clientAccountClaimedMap.has(clientKey)) {
        clientAccountClaimedMap.set(clientKey, false);
      }
    }

    const now = Date.now();

    const clientsWithStatus = clients.map((c: any) => {
      const id = c._id.toString();
      const isShopifyRetailer = c.retailSoftware === 'shopify';

      // Shopify is only truly connected when credentials exist AND a plan
      // has been selected. Matches the definition used everywhere else.
      const shopifyConnected = !!(
        isShopifyRetailer &&
        c.shopify?.accessToken &&
        c.shopify?.hasActivePlan
      );

      // Shopify installed but no plan selected — a distinct warning state
      const shopifyNoPlan = !!(
        isShopifyRetailer &&
        c.shopify?.accessToken &&
        !c.shopify?.hasActivePlan
      );

      const hasRewards = rewardsClientIds.has(id);
      const accountClaimed = clientAccountClaimedMap.get(id) ?? false;

      const createdAt = c.createdAt ? new Date(c.createdAt).getTime() : null;
      const ageMs = createdAt ? now - createdAt : null;
      const olderThan3Days = ageMs !== null && ageMs > THREE_DAYS_MS;

      // Attention flags — items that need your action
      const attentionFlags: string[] = [];

      if (isShopifyRetailer && !c.shopify?.accessToken) {
        attentionFlags.push('shopify_not_connected');
      }
      if (shopifyNoPlan) {
        attentionFlags.push('shopify_no_plan');
      }
      if (!accountClaimed) {
        attentionFlags.push('account_not_claimed');
      }
      if (!hasRewards && olderThan3Days) {
        attentionFlags.push('no_rewards_after_3_days');
      }

      return {
        _id: id,
        name: c.name,
        icon: c.icon,
        createdAt: c.createdAt,
        status: {
          shopifyConnected,
          shopifyNoPlan,
          hasRewards,
          accountClaimed,
          attentionFlags,
          needsAttention: attentionFlags.length > 0,
        },
      };
    });

    return NextResponse.json({ clients: clientsWithStatus });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/admin/client-status' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}