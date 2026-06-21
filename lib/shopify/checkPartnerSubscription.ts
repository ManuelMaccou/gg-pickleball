// lib/shopify/checkPartnerSubscription.ts
//
// Queries the Shopify Partner API to check whether a shop has an active
// managed pricing subscription for this app.
//
// Uses the 2026-07 release candidate Partner API version which is the first
// to support the activeSubscription query. This is the canonical source of
// truth for subscription status with Shopify App Pricing — it correctly
// reflects cancellations and freezes that the Admin API doesn't surface.
//
// Returns:
//   true  — Shopify confirmed an active subscription exists
//   false — Shopify confirmed no active subscription (cancelled, frozen, never subscribed)
//           callers SHOULD write hasActivePlan: false — this is a definitive signal
//   null  — couldn't reach Shopify at all (network error, wrong credentials, API down)
//           callers should NOT change DB state — we have no signal either way

const PARTNER_API_VERSION = '2026-07';

let credentialsLogged = false;

const ACTIVE_SUBSCRIPTION_QUERY = `
  query ActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      cancelAtEndOfCycle
      currentBillingCycle {
        startTime
        endTime
      }
    }
  }
`;

export async function checkPartnerSubscription(shopId: string): Promise<boolean | null> {
  const partnerApiToken = process.env.SHOPIFY_PARTNER_API_TOKEN;
  const partnerOrgId = process.env.SHOPIFY_PARTNER_ORG_ID;
  const appId = process.env.SHOPIFY_GGP_APP_ID;

  if (!credentialsLogged) {
    credentialsLogged = true;
    console.log('[PartnerAPI] Credentials check:', {
      hasToken: !!partnerApiToken,
      hasOrgId: !!partnerOrgId,
      orgIdValue: partnerOrgId ? `${partnerOrgId.slice(0, 4)}...` : 'MISSING',
      hasAppId: !!appId,
      appIdValue: appId ?? 'MISSING',
    });
  }

  // Log env var presence on first call to help diagnose misconfiguration.
  // Logs once per process start, not on every request.
  if (!(checkPartnerSubscription as any)._logged) {
    (checkPartnerSubscription as any)._logged = true;
    console.log('[PartnerAPI] Credentials check:', {
      hasToken: !!partnerApiToken,
      hasOrgId: !!partnerOrgId,
      orgIdValue: partnerOrgId ? `${partnerOrgId.slice(0, 4)}...` : 'MISSING',
      hasAppId: !!appId,
      appIdValue: appId ?? 'MISSING',
    });
  }

  if (!partnerApiToken || !partnerOrgId || !appId) {
    console.warn('[PartnerAPI] Missing credentials — skipping subscription check');
    return null;
  }

  // shopId from the DB is already in GID format: gid://shopify/Shop/123456
  // appId env var should be the numeric ID from the Partner Dashboard URL.
  // The Partner API expects: gid://shopify/App/123456
  const appGid = appId.startsWith('gid://') ? appId : `gid://shopify/App/${appId}`;

  const url = `https://partners.shopify.com/${partnerOrgId}/api/${PARTNER_API_VERSION}/graphql.json`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': partnerApiToken,
      },
      body: JSON.stringify({
        query: ACTIVE_SUBSCRIPTION_QUERY,
        variables: { appId: appGid, shopId },
      }),
    });

    if (!res.ok) {
      // Non-200 means we couldn't complete the query — return null (unknown),
      // not false (confirmed no plan).
      console.error(`[PartnerAPI] HTTP ${res.status} querying activeSubscription for shop ${shopId}`);
      return null;
    }

    const json = await res.json();

    if (json.errors?.length > 0) {
      // GraphQL errors mean the query failed — return null (unknown), not false.
      console.error('[PartnerAPI] GraphQL errors:', json.errors);
      return null;
    }

    // Only treat as "no plan" when the field is explicitly present and null.
    // If data is missing or activeSubscription is absent (malformed response,
    // proxy stripping fields, partial response), return null so the caller
    // treats it as unknown rather than a confirmed cancellation.
    if (!json.data || !('activeSubscription' in json.data)) {
      console.error(
        '[PartnerAPI] Response missing data.activeSubscription — treating as unknown:',
        JSON.stringify(json)
      );
      return null;
    }

    const hasSubscription = json.data.activeSubscription !== null;
    const cancelAtEndOfCycle = json.data.activeSubscription?.cancelAtEndOfCycle ?? null;

    console.log(
      `[PartnerAPI] activeSubscription for shop ${shopId}:`,
      hasSubscription ? 'ACTIVE' : 'NULL (no active plan)',
      cancelAtEndOfCycle !== null ? `| cancelAtEndOfCycle: ${cancelAtEndOfCycle}` : ''
    );

    return hasSubscription;

  } catch (err) {
    console.error('[PartnerAPI] Network error querying activeSubscription:', err);
    return null;
  }
}