// lib/billing/checkBillingActive.ts
//
// Unified "does this client have active billing?" check.
//
// Custom mode → checks whether a Stripe payment method is saved for the client.
//               This is the only thing that gates discount code generation and
//               dashboard access in custom app mode.
//
// Public mode → delegates to checkPartnerSubscription (Shopify Partner API).
//               Behaviour is identical to what existed before this refactor.
//
// Callers:
//   - lib/shopify/createShopifyDiscountCode.ts  (guards code generation)
//   - app/api/brand/shopify-status/route.ts     (syncs hasActivePlan to DB on dashboard load)

import { isCustomAppMode } from '@/lib/shopify/appMode';
import { checkPartnerSubscription } from '@/lib/shopify/checkPartnerSubscription';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import connectToDatabase from '@/lib/mongodb';

export interface BillingStatus {
  /** Whether the client has active billing in whichever mode is running. */
  hasActiveBilling: boolean;
  /**
   * Only populated in public mode — raw boolean | null from checkPartnerSubscription.
   * null means the Partner API call failed (network error, bad credentials, etc.)
   * and should be treated as "unknown, don't overwrite DB."
   */
  partnerApiResult?: boolean | null;
}

/**
 * Check whether a client has active billing.
 *
 * @param clientId   MongoDB ObjectId string for the Client document.
 * @param shopDomain Required in public mode for the Partner API call.
 *                   Ignored in custom mode.
 */
export async function checkBillingActive(
  clientId: string,
  shopDomain?: string
): Promise<BillingStatus> {
  if (isCustomAppMode()) {
    await connectToDatabase();

    const stripeCustomer = await StripeCustomer.findOne({ clientId })
      .select('stripePaymentMethodId')
      .lean();

    const hasActiveBilling = !!stripeCustomer?.stripePaymentMethodId;
    return { hasActiveBilling };
  }

  // ── Public mode: delegate to existing Shopify Partner API check ───────────
  if (!shopDomain) {
    console.warn('[checkBillingActive] shopDomain required in public mode — returning false');
    return { hasActiveBilling: false };
  }

  // checkPartnerSubscription returns: true (active), false (not active), null (API failed)
  const result = await checkPartnerSubscription(shopDomain);
  return {
    hasActiveBilling: result === true,
    partnerApiResult: result,
  };
}