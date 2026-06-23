// app/api/admin/client-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import Admin from '@/app/models/Admin';
import User from '@/app/models/User';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import { logError } from '@/lib/sentry/logger';
import { checkOrderPaidWebhookExists } from '@/lib/shopify/checkOrderPaidWebhook';
import { isCustomAppMode } from '@/lib/shopify/appMode';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    await connectToDatabase();

    const customMode = isCustomAppMode();

    const clients = await Client.find({})
      .select('_id name icon retailSoftware shopify createdAt active')
      .lean();

    const clientIds = clients.map(c => c._id);

    const [rewardConfigs, admins, stripeCustomers] = await Promise.all([
      SourceRewardConfig.find({ 'sponsorships.sponsoringClientId': { $in: clientIds } })
        .select('sponsorships.sponsoringClientId').lean(),
      Admin.find({ location: { $in: clientIds } }).select('location user').lean(),
      customMode
        ? StripeCustomer.find({ clientId: { $in: clientIds } }).select('clientId stripePaymentMethodId').lean()
        : Promise.resolve([]),
    ]);

    const stripePaymentMethodMap = new Map<string, boolean>();
    (stripeCustomers as any[]).forEach(sc => {
      stripePaymentMethodMap.set(sc.clientId.toString(), !!sc.stripePaymentMethodId);
    });

    const rewardsClientIds = new Set(
      rewardConfigs.flatMap(rc => rc.sponsorships.map((s: any) => s.sponsoringClientId.toString()))
    );

    const adminUserIds = admins.map(a => a.user);
    const claimedUsers = await User.find({ _id: { $in: adminUserIds }, accountClaimed: true })
      .select('_id').lean() as { _id: mongoose.Types.ObjectId }[];
    const claimedUserIds = new Set(claimedUsers.map(u => u._id.toString()));

    const clientAccountClaimedMap = new Map<string, boolean>();
    for (const admin of admins) {
      const key = admin.location.toString();
      const claimed = claimedUserIds.has(admin.user.toString());
      if (claimed) clientAccountClaimedMap.set(key, true);
      else if (!clientAccountClaimedMap.has(key)) clientAccountClaimedMap.set(key, false);
    }

    const now = Date.now();

    const clientsWithStatus = await Promise.all(clients.map(async (c: any) => {
      const id = c._id.toString();
      const isShopifyRetailer = c.retailSoftware === 'shopify';
      const hasCredentials = !!(isShopifyRetailer && c.shopify?.accessToken);

      let shopifyConnected: boolean;
      let shopifyNoPlan: boolean;

      if (customMode) {
        const hasStripePM = stripePaymentMethodMap.get(id) ?? false;
        shopifyConnected = hasCredentials && hasStripePM;
        shopifyNoPlan = hasCredentials && !hasStripePM;
      } else {
        shopifyConnected = !!(hasCredentials && c.shopify?.hasActivePlan);
        shopifyNoPlan = !!(hasCredentials && !c.shopify?.hasActivePlan);
      }

      const hasRewards = rewardsClientIds.has(id);
      const accountClaimed = clientAccountClaimedMap.get(id) ?? false;
      const createdAt = c.createdAt ? new Date(c.createdAt).getTime() : null;
      const olderThan3Days = createdAt !== null && (now - createdAt) > THREE_DAYS_MS;

      let webhookStatus: 'registered' | 'missing' | 'unknown' | 'not_applicable' = 'not_applicable';
      if (shopifyConnected && c.shopify?.shopDomain && c.shopify?.accessToken) {
        webhookStatus = await checkOrderPaidWebhookExists(
          id, c.shopify.shopDomain, c.shopify.accessToken, c.shopify.tokenExpiresAt
        );
      }

      const attentionFlags: string[] = [];
      if (isShopifyRetailer && !hasCredentials) attentionFlags.push('shopify_not_connected');
      if (shopifyNoPlan) {
        attentionFlags.push(customMode ? 'stripe_no_payment_method' : 'shopify_no_plan');
      }
      if (!accountClaimed) attentionFlags.push('account_not_claimed');
      if (!hasRewards && olderThan3Days) attentionFlags.push('no_rewards_after_3_days');
      if (webhookStatus === 'missing') attentionFlags.push('shopify_webhook_missing');
      else if (webhookStatus === 'unknown') attentionFlags.push('shopify_webhook_status_unknown');

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
          webhookStatus,
          attentionFlags,
          needsAttention: attentionFlags.length > 0,
        },
      };
    }));

    return NextResponse.json({ clients: clientsWithStatus });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/admin/client-status' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}