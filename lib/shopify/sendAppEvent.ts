// lib/shopify/sendAppEvent.ts
//
// Fires a billing event to the Shopify App Events API for a single
// CommissionRecord. Uses the sale-commission event handle configured
// in the Partner Dashboard (5% revenue share on value sent).
//
// value = commissionBase (order total minus any refunds) — Shopify
// calculates 5% of this on their end.
//
// If the Client is missing shopify.shopId (pre-migration installs),
// fetches it lazily from the Shopify GraphQL API and saves it.

import Client from '@/app/models/Client';
import { getAppEventsToken } from './shopifyAppAuth';
import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

const APP_EVENTS_URL = 'https://api.shopify.com/app/unstable/events';
const SHOPIFY_API_VERSION = '2025-10';

interface SendAppEventParams {
  clientId: string;
  shopifyOrderId: string;
  commissionRecordId: string;
  commissionBase: number;
  orderCreatedAt: Date;
}

interface SendAppEventResult {
  success: boolean;
  shopifyEventKey: string;
  error?: string;
}

export async function sendAppEvent({
  clientId,
  shopifyOrderId,
  commissionRecordId,
  commissionBase,
}: SendAppEventParams): Promise<SendAppEventResult> {
  // ── 1. Get client and resolve credentials ────────────────────────────────
  const client = await Client.findById(clientId)
    .select('shopify.shopDomain shopify.accessToken shopify.shopId shopify.tokenExpiresAt shopify.refreshToken')
    .lean() as {
      shopify?: {
        shopDomain?: string;
        accessToken?: string;
        shopId?: string;
        tokenExpiresAt?: Date;
        refreshToken?: string;
      };
    } | null;

  if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
    return {
      success: false,
      shopifyEventKey: '',
      error: `Client ${clientId} missing Shopify credentials`,
    };
  }

  // ── 2. Proactively refresh token if near expiry ──────────────────────────
  if (tokenNeedsRefresh(client.shopify.tokenExpiresAt)) {
    console.log(`[sendAppEvent] Token near expiry for client ${clientId} — refreshing`);
    const refreshResult = await refreshShopifyToken(clientId);
    if (!refreshResult.success) {
      return {
        success: false,
        shopifyEventKey: '',
        error: `Token refresh failed: ${refreshResult.error}`,
      };
    }
  }

  // ── 3. Resolve shopId (lazy fetch if missing) ────────────────────────────
  let shopId = client.shopify.shopId;

  if (!shopId) {
    // Re-fetch client to get potentially updated accessToken after refresh
    const freshClient = await Client.findById(clientId)
      .select('shopify.shopDomain shopify.accessToken shopify.shopId')
      .lean() as { shopify?: { shopDomain?: string; accessToken?: string; shopId?: string } } | null;

    shopId = freshClient?.shopify?.shopId;

    if (!shopId) {
      shopId = await fetchAndSaveShopId(
        clientId,
        freshClient?.shopify?.shopDomain ?? client.shopify.shopDomain!,
        freshClient?.shopify?.accessToken ?? client.shopify.accessToken!
      ) ?? undefined;
    }

    if (!shopId) {
      return {
        success: false,
        shopifyEventKey: '',
        error: `Could not resolve shopId for client ${clientId}`,
      };
    }
  }

  // ── 4. Build idempotency key ─────────────────────────────────────────────
  const idempotencyKey = `sale-commission-${shopifyOrderId}-${commissionRecordId}`;

  // ── 5. Get App Events bearer token ──────────────────────────────────────
  const token = await getAppEventsToken();

  // ── 6. Fire the event ────────────────────────────────────────────────────
  const res = await fetch(APP_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shop_id: shopId,
      event_handle: 'sale-commission',
      timestamp: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      attributes: {
        value: Math.round(commissionBase * 100), // in cents — Shopify charges 5% of this
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return {
      success: false,
      shopifyEventKey: idempotencyKey,
      error: `App Events API returned ${res.status}: ${body}`,
    };
  }

  const data = await res.json();

  return {
    success: data.success !== false,
    shopifyEventKey: idempotencyKey,
    error: data.error,
  };
}

// ── Helper: fetch shop GID and save to Client ─────────────────────────────────

async function fetchAndSaveShopId(
  clientId: string,
  shopDomain: string,
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: '{ shop { id } }' }),
      }
    );

    if (!res.ok) {
      console.error(`[sendAppEvent] Failed to fetch shopId for ${shopDomain}: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const shopId: string = json?.data?.shop?.id;

    if (!shopId) {
      console.error(`[sendAppEvent] shopId not found in response for ${shopDomain}`);
      return null;
    }

    await Client.findByIdAndUpdate(clientId, {
      $set: { 'shopify.shopId': shopId },
    });

    return shopId;
  } catch (err) {
    console.error(`[sendAppEvent] Error fetching shopId for ${shopDomain}:`, err);
    return null;
  }
}