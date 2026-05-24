// lib/shopify/checkOrderCommissionRisk.ts
//
// Queries a Shopify order via GraphQL Admin API to determine whether
// a commission is safe to collect, should be held, or should be waived.
// Called by the commission cron on day 30 and every 5 days for held records.

import Client from '@/app/models/Client';
import { HoldReason } from '@/app/types/databaseTypes';
import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

const SHOPIFY_API_VERSION = '2025-10';

const COMMISSION_RISK_QUERY = `
  query CommissionRiskCheck($orderId: ID!) {
    order(id: $orderId) {
      id
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney { amount }
      }
      totalRefundedSet {
        shopMoney { amount }
      }
      refunds(first: 10) {
        createdAt
      }
      returnStatus
      disputes {
        status
      }
    }
  }
`;

export type CommissionDecision =
  | { action: 'charge'; commissionBase: number }
  | { action: 'hold'; holdReason: HoldReason }
  | { action: 'waive'; reason: string };

const LOSING_DISPUTE_STATUSES = new Set(['LOST', 'ACCEPTED']);
const ACTIVE_DISPUTE_STATUSES = new Set(['NEEDS_RESPONSE', 'UNDER_REVIEW']);
const ACTIVE_RETURN_STATUSES = new Set([
  'RETURN_REQUESTED',
  'IN_PROGRESS',
  'INSPECTION_COMPLETE',
]);

async function queryOrder(
  shopDomain: string,
  accessToken: string,
  shopifyOrderGid: string
): Promise<{ ok: boolean; status: number; order: any }> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: COMMISSION_RISK_QUERY,
        variables: { orderId: shopifyOrderGid },
      }),
    }
  );

  if (!response.ok) {
    return { ok: false, status: response.status, order: null };
  }

  const json = await response.json();
  return {
    ok: true,
    status: response.status,
    order: json?.data?.order ?? null,
  };
}

export async function checkOrderCommissionRisk(
  shopifyOrderGid: string,
  clientId: string
): Promise<CommissionDecision> {
  // Look up credentials including expiry fields for refresh check
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
    console.error(`[CommissionRisk] Client ${clientId} missing Shopify credentials`);
    return { action: 'hold', holdReason: null };
  }

  const { shopDomain } = client.shopify;
  let { accessToken } = client.shopify;

  // ── Proactive refresh if token is near expiry ─────────────────────────────
  if (tokenNeedsRefresh(client.shopify.tokenExpiresAt)) {
    console.log(`[CommissionRisk] Token near expiry for client ${clientId} — refreshing`);
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      accessToken = refreshResult.accessToken;
    } else {
      console.error(`[CommissionRisk] Token refresh failed for client ${clientId}`);
      return { action: 'hold', holdReason: null };
    }
  }

  // ── Query Shopify ─────────────────────────────────────────────────────────
  let result = await queryOrder(shopDomain, accessToken, shopifyOrderGid);

  // ── Reactive refresh on 401 ───────────────────────────────────────────────
  if (result.status === 401) {
    console.log(`[CommissionRisk] 401 on order query — attempting token refresh`);
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      result = await queryOrder(shopDomain, refreshResult.accessToken, shopifyOrderGid);
    } else {
      console.error(`[CommissionRisk] Token refresh failed after 401 for client ${clientId}`);
      return { action: 'hold', holdReason: null };
    }
  }

  if (!result.ok) {
    console.error(
      `[CommissionRisk] Shopify API error (${result.status}) for order ${shopifyOrderGid}`
    );
    return { action: 'hold', holdReason: null };
  }

  const order = result.order;

  if (!order) {
    console.error(`[CommissionRisk] Order not found: ${shopifyOrderGid}`);
    return { action: 'hold', holdReason: null };
  }

  const fulfillmentStatus: string = order.displayFulfillmentStatus ?? '';
  const orderTotal = parseFloat(order.totalPriceSet?.shopMoney?.amount ?? '0');
  const totalRefunded = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? '0');
  const returnStatus: string = order.returnStatus ?? 'NO_RETURN';
  const disputes: { status: string }[] = order.disputes ?? [];

  console.log(`[CommissionRisk] order ${shopifyOrderGid} fulfillmentStatus:`, fulfillmentStatus);

  // ── Decision logic ────────────────────────────────────────────────────────

  // 1. Order not yet fulfilled — hold until merchant ships.
  if (fulfillmentStatus !== 'FULFILLED') {
    return { action: 'hold', holdReason: 'unfulfilled' };
  }

  // Check for in-flight refunds — refund records exist but amount hasn't settled yet
  const refunds: { createdAt: string }[] = order.refunds ?? [];
  if (refunds.length > 0 && totalRefunded === 0) {
    return { action: 'hold', holdReason: 'return_in_progress' };
  }

  // 2. Check disputes.
  for (const dispute of disputes) {
    if (LOSING_DISPUTE_STATUSES.has(dispute.status)) {
      return { action: 'waive', reason: `Dispute status: ${dispute.status}` };
    }
    if (ACTIVE_DISPUTE_STATUSES.has(dispute.status)) {
      return { action: 'hold', holdReason: 'dispute_active' };
    }
  }

  // 3. Active return process.
  if (ACTIVE_RETURN_STATUSES.has(returnStatus)) {
    return { action: 'hold', holdReason: 'return_in_progress' };
  }

  // 4. Partial refund with return still open.
  if (totalRefunded > 0 && ACTIVE_RETURN_STATUSES.has(returnStatus)) {
    return { action: 'hold', holdReason: 'partial_refund_open' };
  }

  // 5. Return failed or declined — treat as clean.
  if (returnStatus === 'RETURN_FAILED') {
    return { action: 'charge', commissionBase: orderTotal - totalRefunded };
  }

  // 6. Items returned and money moved back — charge on remainder.
  if (returnStatus === 'RETURNED' || totalRefunded > 0) {
    const commissionBase = orderTotal - totalRefunded;
    if (commissionBase <= 0) {
      return { action: 'waive', reason: 'Full refund — no commission base remaining' };
    }
    return { action: 'charge', commissionBase };
  }

  // 7. Everything clean.
  return { action: 'charge', commissionBase: orderTotal };
}