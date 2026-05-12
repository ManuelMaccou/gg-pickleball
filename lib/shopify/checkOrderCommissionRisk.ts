// lib/shopify/checkOrderCommissionRisk.ts
//
// Queries a Shopify order via GraphQL Admin API to determine whether
// a commission is safe to collect, should be held, or should be waived.
// Called by the commission cron on day 30 and every 5 days for held records.

import Client from '@/app/models/Client';

const SHOPIFY_API_VERSION = '2025-10';

const COMMISSION_RISK_QUERY = `
  query CommissionRiskCheck($orderId: ID!) {
    order(id: $orderId) {
      id
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
  | { action: 'charge'; commissionBase: number }  // Charge on this amount
  | { action: 'hold' }                             // Re-check in 5 days
  | { action: 'waive'; reason: string };           // No commission

// Dispute statuses that mean the merchant lost or accepted the chargeback.
const LOSING_DISPUTE_STATUSES = new Set(['LOST', 'ACCEPTED']);
// Dispute statuses that mean it's still in progress.
const ACTIVE_DISPUTE_STATUSES = new Set(['NEEDS_RESPONSE', 'UNDER_REVIEW']);
// Return statuses that mean a return is in progress.
const ACTIVE_RETURN_STATUSES = new Set([
  'RETURN_REQUESTED',
  'IN_PROGRESS',
  'INSPECTION_COMPLETE',
]);

export async function checkOrderCommissionRisk(
  shopifyOrderGid: string,
  clientId: string
): Promise<CommissionDecision> {
  // Look up the shop domain and access token from the Client record.
  const client = await Client.findById(clientId)
    .select('shopify.shopDomain shopify.accessToken')
    .lean() as { shopify?: { shopDomain?: string; accessToken?: string } } | null;

  if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
    console.error(`[CommissionRisk] Client ${clientId} missing Shopify credentials`);
    // Hold rather than waive — don't forfeit commission due to a config issue.
    return { action: 'hold' };
  }

  const { shopDomain, accessToken } = client.shopify;

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
    console.error(
      `[CommissionRisk] Shopify API error (${response.status}) for order ${shopifyOrderGid}`
    );
    return { action: 'hold' };
  }

  const json = await response.json();
  const order = json?.data?.order;

  if (!order) {
    console.error(`[CommissionRisk] Order not found: ${shopifyOrderGid}`);
    // Hold — don't waive just because the query returned empty.
    return { action: 'hold' };
  }

  const orderTotal = parseFloat(order.totalPriceSet?.shopMoney?.amount ?? '0');
  const totalRefunded = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? '0');
  const returnStatus: string = order.returnStatus ?? 'NO_RETURN';
  const disputes: { status: string }[] = order.disputes ?? [];

  // ── Decision logic ────────────────────────────────────────────────────────

  // 1. Check disputes first — most serious signal.
  for (const dispute of disputes) {
    if (LOSING_DISPUTE_STATUSES.has(dispute.status)) {
      return { action: 'waive', reason: `Dispute status: ${dispute.status}` };
    }
    if (ACTIVE_DISPUTE_STATUSES.has(dispute.status)) {
      return { action: 'hold' };
    }
    // WON or PREVENTED — dispute resolved in merchant's favor, continue checking.
  }

  // 2. Check for active return process.
  if (ACTIVE_RETURN_STATUSES.has(returnStatus)) {
    return { action: 'hold' };
  }

  // 3. Check for completed return with refund AND another return still open —
  //    hold everything until all activity resolves.
  if (totalRefunded > 0 && ACTIVE_RETURN_STATUSES.has(returnStatus)) {
    return { action: 'hold' };
  }

  // 4. Return failed or declined — treat as clean.
  if (returnStatus === 'RETURN_FAILED') {
    const commissionBase = orderTotal - totalRefunded;
    return { action: 'charge', commissionBase };
  }

  // 5. Some items were returned and money moved back — charge on what's left.
  if (returnStatus === 'RETURNED' || totalRefunded > 0) {
    const commissionBase = orderTotal - totalRefunded;
    if (commissionBase <= 0) {
      return { action: 'waive', reason: 'Full refund — no commission base remaining' };
    }
    return { action: 'charge', commissionBase };
  }

  // 6. Everything clean.
  return { action: 'charge', commissionBase: orderTotal };
}