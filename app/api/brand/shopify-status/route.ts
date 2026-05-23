// app/api/brand/shopify-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import { refreshShopifyToken, tokenNeedsRefresh } from '@/lib/shopify/refreshShopifyToken';
import { logError } from '@/lib/sentry/logger';

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
      .select('shopify.shopDomain shopify.accessToken shopify.tokenExpiresAt shopify.refreshToken')
      .lean() as {
        shopify?: {
          shopDomain?: string;
          accessToken?: string;
          tokenExpiresAt?: Date;
          refreshToken?: string;
        };
      } | null;

    // ── No credentials stored ─────────────────────────────────────────────
    if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
      return NextResponse.json({ connected: false, reason: 'no_credentials' });
    }

    let { accessToken } = client.shopify;
    const { shopDomain, tokenExpiresAt } = client.shopify;

    // ── Proactive refresh if token is near expiry ─────────────────────────
    if (tokenNeedsRefresh(tokenExpiresAt)) {
      console.log('[ShopifyStatus] Token near expiry — refreshing proactively');
      const refreshResult = await refreshShopifyToken(user.adminLocationId);
      if (refreshResult.success && refreshResult.accessToken) {
        accessToken = refreshResult.accessToken;
      } else {
        // Refresh failed — token is expired and can't be renewed
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
    }

    // ── Query Shopify directly ────────────────────────────────────────────
    let result: Awaited<ReturnType<typeof queryShopifyInstallation>>;
    try {
      result = await queryShopifyInstallation(shopDomain, accessToken);
    } catch (fetchErr) {
      logError(fetchErr, { endpoint: 'GET /api/brand/shopify-status', task: 'GraphQL fetch' });
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    // ── 401 — attempt refresh then retry once ─────────────────────────────
    if (result.status === 401) {
      console.log('[ShopifyStatus] Token rejected (401) — attempting refresh');
      const refreshResult = await refreshShopifyToken(user.adminLocationId);

      if (!refreshResult.success || !refreshResult.accessToken) {
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }

      // Retry with the new token
      try {
        result = await queryShopifyInstallation(shopDomain, refreshResult.accessToken);
      } catch (fetchErr) {
        logError(fetchErr, { endpoint: 'GET /api/brand/shopify-status', task: 'GraphQL retry' });
        return NextResponse.json({ connected: false, reason: 'query_failed' });
      }

      // If still failing after refresh, something is genuinely wrong
      if (result.status === 401 || result.status === 403) {
        await Client.findByIdAndUpdate(user.adminLocationId, {
          $unset: { 'shopify.accessToken': '' },
        });
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
    }

    // ── 403 — permanent auth failure ─────────────────────────────────────
    if (result.status === 403) {
      console.log('[ShopifyStatus] Token rejected (403) — clearing credentials');
      await Client.findByIdAndUpdate(user.adminLocationId, {
        $unset: { 'shopify.accessToken': '' },
      });
      return NextResponse.json({ connected: false, reason: 'uninstalled' });
    }

    // ── Other non-OK ──────────────────────────────────────────────────────
    if (!result.ok) {
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    // ── GraphQL auth errors ───────────────────────────────────────────────
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
        });
        return NextResponse.json({ connected: false, reason: 'uninstalled' });
      }
      return NextResponse.json({ connected: false, reason: 'query_failed' });
    }

    // ── No installation returned ──────────────────────────────────────────
    if (!result.installation) {
      console.log('[ShopifyStatus] currentAppInstallation returned null');
      await Client.findByIdAndUpdate(user.adminLocationId, {
        $unset: { 'shopify.accessToken': '' },
      });
      return NextResponse.json({ connected: false, reason: 'uninstalled' });
    }

    return NextResponse.json({ connected: true });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/brand/shopify-status' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}