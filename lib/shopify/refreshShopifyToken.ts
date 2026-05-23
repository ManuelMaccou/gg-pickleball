// lib/shopify/refreshShopifyToken.ts
//
// Exchanges a refresh token for a new access token + refresh token pair.
// Saves the new tokens to the Client document.
//
// Called:
//   - Proactively when the access token is within 5 minutes of expiry
//   - Reactively on 401 responses from Shopify GraphQL calls
//
// If the refresh token itself has expired (90 days), the merchant must
// reconnect Shopify — nothing we can do programmatically.

import Client from '@/app/models/Client';
import { logError } from '@/lib/sentry/logger';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface RefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

export async function refreshShopifyToken(clientId: string): Promise<RefreshResult> {
  try {
    const client = await Client.findById(clientId)
      .select('shopify.shopDomain shopify.refreshToken shopify.tokenExpiresAt')
      .lean() as {
        shopify?: {
          shopDomain?: string;
          refreshToken?: string;
          tokenExpiresAt?: Date;
        };
      } | null;

    if (!client?.shopify?.shopDomain || !client?.shopify?.refreshToken) {
      return { success: false, error: 'Missing shopDomain or refreshToken' };
    }

    const { shopDomain, refreshToken } = client.shopify;

    const res = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: process.env.SHOPIFY_API_KEY!,
          client_secret: process.env.SHOPIFY_API_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      // 400/401 on the refresh endpoint means the refresh token expired
      // The merchant needs to reconnect
      if (res.status === 400 || res.status === 401) {
        // Clear tokens so the dashboard shows the reconnect callout
        await Client.findByIdAndUpdate(clientId, {
          $unset: {
            'shopify.accessToken': '',
            'shopify.refreshToken': '',
            'shopify.tokenExpiresAt': '',
            'shopify.refreshTokenExpiresAt': '',
          },
        });
        return {
          success: false,
          error: `Refresh token expired — merchant must reconnect Shopify`,
        };
      }
      return {
        success: false,
        error: `Refresh failed (${res.status}): ${body}`,
      };
    }

    const data = await res.json();
    const {
      access_token,
      expires_in,
      refresh_token: newRefreshToken,
      refresh_token_expires_in,
    } = data;

    if (!access_token) {
      return { success: false, error: 'Refresh response missing access_token' };
    }

    const now = Date.now();
    const tokenExpiresAt = new Date(now + expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now + refresh_token_expires_in * 1000);

    await Client.findByIdAndUpdate(clientId, {
      $set: {
        'shopify.accessToken': access_token,
        'shopify.refreshToken': newRefreshToken,
        'shopify.tokenExpiresAt': tokenExpiresAt,
        'shopify.refreshTokenExpiresAt': refreshTokenExpiresAt,
      },
    });

    console.log(
      `[ShopifyRefresh] Token refreshed for client ${clientId}. ` +
      `New expiry: ${tokenExpiresAt.toISOString()}`
    );

    return { success: true, accessToken: access_token };
  } catch (err: any) {
    logError(err, { context: `refreshShopifyToken for client ${clientId}` });
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

// ── Helper: check if token needs refresh ─────────────────────────────────────
// Returns true if the token is missing, expired, or within the refresh buffer.

export function tokenNeedsRefresh(tokenExpiresAt?: Date | null): boolean {
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
}