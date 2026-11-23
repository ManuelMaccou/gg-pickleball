// lib/shopify/shopifyAdminQuery.ts
//
// Runs a GraphQL Admin API query against a client's Shopify store, with the
// same token handling the commission cron has always used: proactive refresh
// when the token is near expiry, and one reactive refresh + retry on 401.

import Client from '@/app/models/Client';
import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

export const SHOPIFY_API_VERSION = '2026-10';

export type ShopifyAdminQueryResult =
  | { ok: true; data: any }
  | { ok: false; reason: string };

async function postQuery(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ status: number; json: any }> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!response.ok) return { status: response.status, json: null };
  return { status: response.status, json: await response.json() };
}

export async function shopifyAdminQuery(
  clientId: string,
  query: string,
  variables: Record<string, unknown>,
  logTag = '[ShopifyAdminQuery]'
): Promise<ShopifyAdminQueryResult> {
  const client = await Client.findById(clientId)
    .select('shopify.shopDomain shopify.accessToken shopify.tokenExpiresAt shopify.refreshToken')
    .lean() as {
      shopify?: {
        shopDomain?: string;
        accessToken?: string;
        tokenExpiresAt?: Date;
        refreshToken?: string;
      };
    } | null;

  if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
    console.error(`${logTag} Client ${clientId} missing Shopify credentials`);
    return { ok: false, reason: 'missing_credentials' };
  }

  const { shopDomain } = client.shopify;
  let { accessToken } = client.shopify;

  // ── Proactive refresh if token is near expiry ─────────────────────────────
  if (tokenNeedsRefresh(client.shopify.tokenExpiresAt)) {
    console.log(`${logTag} Token near expiry for client ${clientId} — refreshing`);
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      accessToken = refreshResult.accessToken;
    } else {
      console.error(`${logTag} Token refresh failed for client ${clientId}`);
      return { ok: false, reason: 'token_refresh_failed' };
    }
  }

  let result = await postQuery(shopDomain, accessToken, query, variables);

  // ── Reactive refresh on 401 ───────────────────────────────────────────────
  if (result.status === 401) {
    console.log(`${logTag} 401 on query — attempting token refresh`);
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      result = await postQuery(shopDomain, refreshResult.accessToken, query, variables);
    } else {
      console.error(`${logTag} Token refresh failed after 401 for client ${clientId}`);
      return { ok: false, reason: 'token_refresh_failed' };
    }
  }

  if (!result.json) {
    console.error(`${logTag} Shopify API error (${result.status})`);
    return { ok: false, reason: `http_${result.status}` };
  }

  if (result.json.errors) {
    console.error(`${logTag} GraphQL errors:`, JSON.stringify(result.json.errors));
    return { ok: false, reason: 'graphql_errors' };
  }

  return { ok: true, data: result.json.data };
}
