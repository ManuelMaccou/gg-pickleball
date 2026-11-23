// lib/shopify/commissionBase.ts
//
// The commission base: what GG takes its commission percentage of.
//
//   Products after all discounts
//   − tax, shipping and tips (never included)
//   − gift cards bought at full price (only a gift card the GG code actually
//     discounted counts — see below)
//   − refunds the store has recorded in Shopify
//
// Why gift cards are special: GG codes are order-wide discounts, and Shopify
// never applies order-wide discounts to gift cards. A full-price gift card in a
// GG order earns nothing here; GG earns when the card is later spent on an
// order that uses a GG code. Counting it now as well would charge commission
// twice on the same money. A gift card the brand chose to discount (a
// buy-1-get-1, or a code that targets it) does count.
//
// Used in two places, so the "Sale" a brand sees and what the cron charges
// come from the same formula:
//   - the order webhook, when the CommissionRecord is created
//   - the day-30 cron (checkOrderCommissionRisk), which re-reads the order

import { shopifyAdminQuery } from './shopifyAdminQuery';

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (set: any): number => parseFloat(set?.shopMoney?.amount ?? '0') || 0;

// Fields selected on `order` by every query that computes the base.
export const ORDER_COMMISSION_BASE_FIELDS = `
  totalTipReceivedSet { shopMoney { amount } }
  lineItems(first: 100) {
    pageInfo { hasNextPage }
    nodes {
      id
      isGiftCard
      priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount } }
      discountAllocations { allocatedAmountSet { shopMoney { amount } } }
    }
  }
  refunds(first: 20) {
    createdAt
    totalRefundedSet { shopMoney { amount } }
    refundLineItems(first: 100) {
      nodes {
        subtotalSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
      }
    }
    refundShippingLines(first: 10) {
      nodes {
        subtotalAmountSet { shopMoney { amount } }
        taxAmountSet { shopMoney { amount } }
      }
    }
  }
`;

const ORDER_COMMISSION_BASE_QUERY = `
  query OrderCommissionBase($orderId: ID!) {
    order(id: $orderId) {
      id
      ${ORDER_COMMISSION_BASE_FIELDS}
    }
  }
`;

// Tips are line items linked from a TipSale. Only asked for when the order
// actually has a tip, so a problem with this query can only affect tipped
// orders.
const ORDER_TIP_LINE_ITEMS_QUERY = `
  query OrderTipLineItems($orderId: ID!) {
    order(id: $orderId) {
      agreements(first: 20) {
        nodes {
          sales(first: 100) {
            nodes {
              __typename
              ... on TipSale { lineItem { id } }
            }
          }
        }
      }
    }
  }
`;

async function fetchTipLineItemIds(
  shopifyOrderGid: string,
  clientId: string
): Promise<Set<string> | null> {
  const result = await shopifyAdminQuery(
    clientId,
    ORDER_TIP_LINE_ITEMS_QUERY,
    { orderId: shopifyOrderGid },
    '[CommissionBase:tips]'
  );
  if (!result.ok || !result.data?.order) return null;

  const ids = new Set<string>();
  for (const agreement of result.data.order.agreements?.nodes ?? []) {
    for (const sale of agreement?.sales?.nodes ?? []) {
      if (sale?.__typename === 'TipSale' && sale.lineItem?.id) ids.add(sale.lineItem.id);
    }
  }
  return ids;
}

export interface OrderAmounts {
  /** What the commission is a percentage of (see header). */
  commissionBase: number;
  /** Every product incl. gift cards, after discounts, no tax/shipping/tips.
   *  Display only — shown as "Products subtotal" on the billing pages. */
  productsSubtotal: number;
}

/**
 * Commission base (and products subtotal) from an order already fetched with
 * ORDER_COMMISSION_BASE_FIELDS. Returns null when it can't be worked out
 * reliably (more than 100 line items, or a tip that couldn't be identified) —
 * callers should hold the record rather than guess.
 */
export async function computeOrderAmounts(
  order: any,
  shopifyOrderGid: string,
  clientId: string
): Promise<OrderAmounts | null> {
  if (order?.lineItems?.pageInfo?.hasNextPage) {
    console.warn(`[CommissionBase] Order ${shopifyOrderGid} has more than 100 line items`);
    return null;
  }

  let tipLineItemIds = new Set<string>();
  if (money(order?.totalTipReceivedSet) > 0) {
    const ids = await fetchTipLineItemIds(shopifyOrderGid, clientId);
    if (!ids) {
      console.warn(`[CommissionBase] Couldn't identify tip line items on ${shopifyOrderGid}`);
      return null;
    }
    tipLineItemIds = ids;
  }

  // 1. Products after all discounts, without tax. Shopify already removes
  //    refunded and returned units from this figure. Shipping isn't a line item.
  let productTotal = 0;
  let productsSubtotal = 0;
  for (const li of order?.lineItems?.nodes ?? []) {
    if (tipLineItemIds.has(li.id)) continue;

    productsSubtotal += money(li.priceAfterAllDiscountsBeforeTaxesSet);

    if (li.isGiftCard) {
      const discounted = (li.discountAllocations ?? []).reduce(
        (sum: number, d: any) => sum + money(d?.allocatedAmountSet),
        0
      );
      if (discounted <= 0) continue; // full-price gift card — see header
    }

    productTotal += money(li.priceAfterAllDiscountsBeforeTaxesSet);
  }

  // 2. Money-only refunds: whatever a refund returned beyond the items and
  //    shipping it lists (cash back, a custom amount). Shopify doesn't say how
  //    much of that was tax, so all of it comes off the product total.
  let moneyOnlyRefunds = 0;
  for (const refund of order?.refunds ?? []) {
    const refunded = money(refund?.totalRefundedSet);
    const items = (refund?.refundLineItems?.nodes ?? []).reduce(
      (sum: number, r: any) => sum + money(r?.subtotalSet) + money(r?.totalTaxSet),
      0
    );
    const shipping = (refund?.refundShippingLines?.nodes ?? []).reduce(
      (sum: number, r: any) => sum + money(r?.subtotalAmountSet) + money(r?.taxAmountSet),
      0
    );
    const extra = refunded - items - shipping;
    if (extra > 0.005) moneyOnlyRefunds += extra;
  }

  return {
    commissionBase: round2(Math.max(0, productTotal - moneyOnlyRefunds)),
    productsSubtotal: round2(Math.max(0, productsSubtotal)),
  };
}

/** Commission base only — what the day-30 cron charges on. */
export async function computeCommissionBase(
  order: any,
  shopifyOrderGid: string,
  clientId: string
): Promise<number | null> {
  const amounts = await computeOrderAmounts(order, shopifyOrderGid, clientId);
  return amounts ? amounts.commissionBase : null;
}

/** Fetches the order from Shopify and returns its amounts, or null. */
export async function fetchOrderAmounts(
  shopifyOrderGid: string,
  clientId: string
): Promise<OrderAmounts | null> {
  try {
    const result = await shopifyAdminQuery(
      clientId,
      ORDER_COMMISSION_BASE_QUERY,
      { orderId: shopifyOrderGid },
      '[CommissionBase]'
    );
    if (!result.ok || !result.data?.order) return null;
    return await computeOrderAmounts(result.data.order, shopifyOrderGid, clientId);
  } catch (err) {
    console.error(`[CommissionBase] Failed for ${shopifyOrderGid}:`, err);
    return null;
  }
}

/**
 * Fallback for when the Shopify query fails at webhook time: the same rules
 * applied to the ORDERS_PAID webhook payload. The day-30 cron always
 * recalculates from Shopify, so this only affects the "Sale" shown until then.
 */
export function orderAmountsFromWebhookPayload(payload: any): OrderAmounts {
  let base = 0;
  let subtotal = 0;
  for (const li of payload?.line_items ?? []) {
    // Tip entries carry these fields; products never do.
    if (li?.tip_payment_gateway || li?.tip_payment_method) continue;

    const gross = (parseFloat(li?.price ?? '0') || 0) * (Number(li?.quantity) || 0);
    const discount = (li?.discount_allocations ?? []).reduce(
      (sum: number, d: any) => sum + (parseFloat(d?.amount ?? '0') || 0),
      0
    );
    let lineBase = gross - discount;
    if (payload?.taxes_included) {
      lineBase -= (li?.tax_lines ?? []).reduce(
        (sum: number, t: any) => sum + (parseFloat(t?.price ?? '0') || 0),
        0
      );
    }
    subtotal += lineBase;
    if (li?.gift_card && discount <= 0) continue; // full-price gift card
    base += lineBase;
  }
  return {
    commissionBase: round2(Math.max(0, base)),
    productsSubtotal: round2(Math.max(0, subtotal)),
  };
}
