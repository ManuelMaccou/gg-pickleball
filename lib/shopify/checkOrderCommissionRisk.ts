// lib/shopify/checkOrderCommissionRisk.ts
//
// Queries a Shopify order via GraphQL Admin API to determine whether
// a commission is safe to collect, should be held, or should be waived.
// Called by the commission cron on day 30 and every 5 days for held records.

import { HoldReason } from '@/app/types/databaseTypes';
import { shopifyAdminQuery } from './shopifyAdminQuery';
import { ORDER_COMMISSION_BASE_FIELDS, computeCommissionBase } from './commissionBase';

const COMMISSION_RISK_QUERY = `
  query CommissionRiskCheck($orderId: ID!) {
    order(id: $orderId) {
      id
      displayFulfillmentStatus
      totalRefundedSet {
        shopMoney { amount }
      }
      returnStatus
      disputes {
        status
      }
      ${ORDER_COMMISSION_BASE_FIELDS}
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

export async function checkOrderCommissionRisk(
  shopifyOrderGid: string,
  clientId: string
): Promise<CommissionDecision> {
  const result = await shopifyAdminQuery(
    clientId,
    COMMISSION_RISK_QUERY,
    { orderId: shopifyOrderGid },
    '[CommissionRisk]'
  );

  if (!result.ok) {
    console.error(`[CommissionRisk] Query failed (${result.reason}) for order ${shopifyOrderGid}`);
    return { action: 'hold', holdReason: null };
  }

  const order = result.data?.order;

  if (!order) {
    console.error(`[CommissionRisk] Order not found: ${shopifyOrderGid}`);
    return { action: 'hold', holdReason: null };
  }

  const fulfillmentStatus: string = order.displayFulfillmentStatus ?? '';
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

  // 5–7. Work out the commission base: products after discounts, no tax,
  //      shipping, tips or full-price gift cards, minus refunds recorded in
  //      Shopify (lib/shopify/commissionBase.ts). Returned items and
  //      money-only refunds are already taken off, so a failed return, a
  //      partial refund and a clean order all charge on this same figure.
  const commissionBase = await computeCommissionBase(order, shopifyOrderGid, clientId);

  if (commissionBase === null) {
    // Couldn't work it out reliably — hold; unresolved by day 60 → review.
    return { action: 'hold', holdReason: null };
  }

  if (commissionBase <= 0) {
    return {
      action: 'waive',
      reason: totalRefunded > 0
        ? 'Full refund — no commission base remaining'
        : 'No commissionable products on order',
    };
  }

  return { action: 'charge', commissionBase };
}