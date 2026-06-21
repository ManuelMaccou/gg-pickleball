// app/api/shopify/cron/refresh-shopify-tokens/route.ts
//
// Daily cron that proactively refreshes Shopify access tokens for all
// connected brand clients before they expire.
//
// How it works:
//   - Finds all Clients with a Shopify accessToken stored
//   - Refreshes any whose accessToken expires within the next 24 hours
//   - Each refresh returns a new accessToken + new refreshToken with a
//     fresh 90-day TTL — so refresh tokens never expire as long as this
//     cron runs at least once every 90 days
//   - Logs a warning for any client whose refresh fails so you can
//     reach out to the merchant to reconnect
//
// Schedule: Daily at 3am UTC (or any low-traffic time)
// Railway cron command:
//   curl -X POST http://localhost:3000/api/shopify/cron/refresh-shopify-tokens -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { refreshShopifyToken } from '@/lib/shopify/refreshShopifyToken';
import { logError } from '@/lib/sentry/logger';

// Refresh tokens whose access token expires within this window
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Warn when refresh token expires within this window
const REFRESH_TOKEN_WARNING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const now = new Date();
    const refreshBefore = new Date(now.getTime() + REFRESH_WINDOW_MS);

    // Find all clients with Shopify connected
    const clients = await Client.find({
      'shopify.accessToken': { $exists: true, $ne: null },
      'shopify.shopDomain': { $exists: true, $ne: null },
    })
      .select('_id name shopify.shopDomain shopify.tokenExpiresAt shopify.refreshTokenExpiresAt')
      .lean() as unknown as Array<{
        _id: any;
        name: string;
        shopify: {
          shopDomain?: string;
          tokenExpiresAt?: Date;
          refreshTokenExpiresAt?: Date;
        };
      }>;

    console.log(`[TokenRefreshCron] Found ${clients.length} connected client(s)`);

    const results = {
      checked: clients.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      warnings: 0,
    };

    for (const client of clients) {
      try {
        const clientId = client._id.toString();
        const { tokenExpiresAt, refreshTokenExpiresAt } = client.shopify;

        // ── Warn if refresh token is near expiry ───────────────────────────────
        if (refreshTokenExpiresAt) {
          const msUntilRefreshExpiry = refreshTokenExpiresAt.getTime() - now.getTime();
          if (msUntilRefreshExpiry < REFRESH_TOKEN_WARNING_MS) {
            const daysLeft = Math.floor(msUntilRefreshExpiry / (1000 * 60 * 60 * 24));
            console.warn(
              `[TokenRefreshCron] ⚠️ Client "${client.name}" (${clientId}) refresh token ` +
              `expires in ${daysLeft} day(s). Merchant should reconnect Shopify soon.`
            );
            results.warnings++;
          }
        }

        // ── Skip if access token is still healthy ─────────────────────────────
        if (tokenExpiresAt && tokenExpiresAt.getTime() > refreshBefore.getTime()) {
          results.skipped++;
          continue;
        }

        // ── Refresh the token ─────────────────────────────────────────────────
        console.log(
          `[TokenRefreshCron] Refreshing token for client "${client.name}" (${clientId})` +
          (tokenExpiresAt ? ` — expires ${tokenExpiresAt.toISOString()}` : ' — no expiry recorded')
        );

        const refreshResult = await refreshShopifyToken(clientId);

        if (refreshResult.success) {
          console.log(`[TokenRefreshCron] ✅ Refreshed token for client "${client.name}"`);
          results.refreshed++;
        } else {
          console.error(
            `[TokenRefreshCron] ❌ Failed to refresh token for client "${client.name}" ` +
            `(${clientId}): ${refreshResult.error}`
          );
          logError(new Error(refreshResult.error ?? 'Token refresh failed'), {
            context: `TokenRefreshCron client ${clientId} (${client.name})`,
          });
          results.failed++;
        }
      } catch (err) {
        console.error('[TokenRefreshCron] Error processing client:', client._id, err);
        results.failed++;
      }
    }

    console.log('[TokenRefreshCron] Complete:', results);

    return NextResponse.json({ results });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'POST /api/shopify/cron/refresh-shopify-tokens' });
    return NextResponse.json({ error: 'Internal server error', errorId }, { status: 500 });
  }
}