// lib/shopify/getShopifyCredentials.ts
//
// Resolves the Shopify API key and secret for a given client's envKey.
//
// Custom app mode: each client has their own Shopify custom app in the
// Partner Dashboard. Credentials are stored as env vars keyed by envKey:
//
//   SHOPIFY_API_KEY_<ENVKEY>=...
//   SHOPIFY_API_SECRET_<ENVKEY>=...
//
// Example — if client.shopify.envKey = "PADELHAUS":
//   SHOPIFY_API_KEY_PADELHAUS=abc123
//   SHOPIFY_API_SECRET_PADELHAUS=xyz789
//
// Public app mode: all clients share a single pair of credentials via the
// standard SHOPIFY_API_KEY / SHOPIFY_API_SECRET env vars. envKey is ignored.
//
// TO REVERT TO PUBLIC APP:
//   Set SHOPIFY_APP_MODE=public. This function returns the shared credentials
//   regardless of envKey. Per-client env vars are ignored but harmless.

import { isCustomAppMode } from '@/lib/shopify/appMode';

export interface ShopifyCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Resolve Shopify API credentials for a client.
 *
 * @param envKey  The client's envKey (e.g. "PADELHAUS"). Required in custom
 *                mode. Ignored in public mode.
 * @returns       { apiKey, apiSecret } or null if credentials are missing.
 */
export function getShopifyCredentials(envKey?: string | null): ShopifyCredentials | null {
  if (isCustomAppMode()) {
    if (!envKey) {
      console.error('[getShopifyCredentials] Custom mode requires envKey — not set on client record');
      return null;
    }

    const apiKey = process.env[`SHOPIFY_API_KEY_${envKey}`];
    const apiSecret = process.env[`SHOPIFY_API_SECRET_${envKey}`];

    if (!apiKey || !apiSecret) {
      console.error(
        `[getShopifyCredentials] Missing env vars for envKey "${envKey}": ` +
        `SHOPIFY_API_KEY_${envKey}=${apiKey ? 'set' : 'MISSING'}, ` +
        `SHOPIFY_API_SECRET_${envKey}=${apiSecret ? 'set' : 'MISSING'}`
      );
      return null;
    }

    return { apiKey, apiSecret };
  }

  // Public mode — shared credentials
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('[getShopifyCredentials] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET');
    return null;
  }

  return { apiKey, apiSecret };
}