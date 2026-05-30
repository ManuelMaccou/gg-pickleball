// app/api/brand/shopify-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import { refreshShopifyToken, tokenNeedsRefresh } from '@/lib/shopify/refreshShopifyToken';
import { logError } from '@/lib/sentry/logger';
import { checkPartnerSubscription } from '@/lib/shopify/checkPartnerSubscription';

const SHOPIFY_API_VERSION = '2025-10';

const CURRENT_APP_INSTALLATION_QUERY = `
  query {
    currentAppInstallation {
      id
      activeSubscriptions {
        id
        status
      }
    }
  }
`;

async function queryShopifyInstallation(
  shopDomain: string,
  accessToken: string
): Promise<{ ok: boolean; status: number; installation: any; errors: any[] }> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: CURRENT_APP_INSTALLATION_QUERY }),
    }
  );

  if (!res.ok) {
    return { ok: false, status: res.status, installation: null, errors: [] };
  }

  const json = await res.json();
  return {
    ok: true,
    status: res.status,
    installation: json?.data?.currentAppInstallation ?? null,
    errors: json?.errors ?? [],
  };
}

// Fetches shopId from DB — needed for the Partner API subscription check.
// Returns null if not stored yet (will be fetched lazily on next billing event).
async function getShopId(clientId: string): Promise<string | null> {
  try {
    const client = await Client.findById(clientId)
      .select('shopify.shopId')
      .lean() as { shopify?: { shopId?: string } } | null;
    return client?.shopify?.shopId ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    await connectToDatabase();

    const client = await Client.findById(user.adminLocationId)
      .select('shopify.shopDomain shopify.accessToken shopify.tokenExpiresAt shopify.refreshToken shopify.hasActivePlan')
      .lean() as {
        shopify?: {
          shopDomain?: string;
          accessToken?: string;
          tokenExpiresAt?: Date;
          refreshToken?: string;
          hasActivePlan?: boolean;
        };
      } | null;

    if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
      return NextResponse.json({ connected: false, reason: 'no_credentials' });
    }

    let { accessToken } = client.shopify;
    const { shopDomain, tokenExpiresAt } = client.shopify;
    // Capture the DB value before any Shopify queries so we can use it
    // as a tiebreaker in the eventual consistency window after plan selection.
    const dbHasActivePlan = client.shopify.hasActivePlan ?? false;
    console.log(`[ShopifyStatus] DB state on load — hasActivePlan: ${dbHasActivePlan}, shopDomain: ${client.shopify.shopDomain}`);

    if (tokenNeedsRefresh(tokenExpiresAt)) {
      console.log('[ShopifyStatus] Token near expiry — refreshing proactively');
      const refreshResult = await refreshShopifyToken(user.adminLocationId);
      if (refreshResult.success && refreshResult.accessToken) {
        accessToken = refreshResult.accessToken;
      } else {
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
    }

    let result: Awaited<ReturnType<typeof queryShopifyInstallation>>;
    try {
      result = await queryShopifyInstallation(shopDomain, accessToken);
    } catch (fetchErr) {
      logError(fetchErr, { endpoint: 'GET /api/brand/shopify-status', task: 'GraphQL fetch' });
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    if (result.status === 401) {
      console.log('[ShopifyStatus] Token rejected (401) — attempting refresh');
      const refreshResult = await refreshShopifyToken(user.adminLocationId);

      if (!refreshResult.success || !refreshResult.accessToken) {
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }

      try {
        result = await queryShopifyInstallation(shopDomain, refreshResult.accessToken);
      } catch (fetchErr) {
        logError(fetchErr, { endpoint: 'GET /api/brand/shopify-status', task: 'GraphQL retry' });
        return NextResponse.json({ connected: false, reason: 'query_failed' });
      }

      if (result.status === 401 || result.status === 403) {
        await Client.findByIdAndUpdate(user.adminLocationId, {
          $unset: { 'shopify.accessToken': '' },
          $set: { 'shopify.hasActivePlan': false },
        });
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
    }

    if (result.status === 403) {
      console.log('[ShopifyStatus] Token rejected (403) — clearing credentials');
      await Client.findByIdAndUpdate(user.adminLocationId, {
        $unset: { 'shopify.accessToken': '' },
        $set: { 'shopify.hasActivePlan': false },
      });
      return NextResponse.json({ connected: false, reason: 'uninstalled' });
    }

    if (!result.ok) {
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    if (result.errors.length > 0) {
      const isAuthError = result.errors.some(
        (e: any) =>
          e.extensions?.code === 'UNAUTHORIZED' ||
          e.message?.toLowerCase().includes('access denied') ||
          e.message?.toLowerCase().includes('unauthorized')
      );
      if (isAuthError) {
        await Client.findByIdAndUpdate(user.adminLocationId, {
          $unset: { 'shopify.accessToken': '' },
          $set: { 'shopify.hasActivePlan': false },
        });
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    if (!result.installation) {
      console.log('[ShopifyStatus] currentAppInstallation returned null');
      await Client.findByIdAndUpdate(user.adminLocationId, {
        $unset: { 'shopify.accessToken': '' },
        $set: { 'shopify.hasActivePlan': false },
      });
      return NextResponse.json({ connected: false, reason: 'uninstalled' });
    }

    // ── Check active subscription via Partner API ────────────────────────
    // The Partner API's activeSubscription query is the canonical source of
    // truth for Shopify App Pricing. It correctly reflects cancellations and
    // freezes that the Admin API activeSubscriptions field doesn't surface.
    //
    // We only use the Admin API result as a fallback when the Partner API is
    // unavailable (missing credentials, network error, etc.).
    const shopId = result.installation
      ? await getShopId(user.adminLocationId)
      : null;
    console.log(`[ShopifyStatus] shopId for Partner API check: ${shopId ?? 'NOT FOUND — will use Admin API fallback'}`);

    let hasActivePlan: boolean;

    if (shopId) {
      const partnerResult = await checkPartnerSubscription(shopId);

      if (partnerResult === null) {
        // Partner API query itself failed (network error, wrong credentials,
        // API down) — we have no signal either way. Leave DB unchanged and
        // use the existing DB value. This is the only case where we don't
        // update — a real cancellation returns false, not null.
        console.log('[ShopifyStatus] Partner API query failed — leaving DB unchanged, using existing value');
        hasActivePlan = dbHasActivePlan;
      } else {
        // partnerResult is true or false — Shopify gave us a definitive answer.
        // Always write this back to DB so it stays current regardless of
        // which direction the change went.
        hasActivePlan = partnerResult;
        if (partnerResult !== dbHasActivePlan) {
          await Client.findByIdAndUpdate(user.adminLocationId, {
            $set: { 'shopify.hasActivePlan': partnerResult },
          });
          console.log(`[ShopifyStatus] Synced hasActivePlan: ${dbHasActivePlan} → ${partnerResult}`);
        }
      }
    } else {
      // No shopId — can't call Partner API. Fall back to Admin API subscription
      // check as a best-effort signal.
      const adminHasActivePlan = (result.installation?.activeSubscriptions ?? []).length > 0;
      hasActivePlan = adminHasActivePlan;
      if (adminHasActivePlan !== dbHasActivePlan) {
        await Client.findByIdAndUpdate(user.adminLocationId, {
          $set: { 'shopify.hasActivePlan': adminHasActivePlan },
        });
        console.log(`[ShopifyStatus] No shopId — Admin API synced hasActivePlan: ${dbHasActivePlan} → ${adminHasActivePlan}`);
      }
    }

    console.log(`[ShopifyStatus] Final hasActivePlan decision: ${hasActivePlan}`);

    if (!hasActivePlan) {
      return NextResponse.json({
        connected: true,
        hasActivePlan: false,
        reason: 'no_plan',
      });
    }

    return NextResponse.json({ connected: true, hasActivePlan: true });

  } catch (err) {
    logError(err, { endpoint: 'GET /api/brand/shopify-status' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}