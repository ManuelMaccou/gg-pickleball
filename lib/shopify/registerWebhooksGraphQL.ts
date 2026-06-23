// lib/shopify/registerWebhooksGraphQL.ts
//
// Registers Shopify webhooks via the GraphQL Admin API.
// Called at the end of the OAuth callback in both custom and public mode.
//
// Webhooks registered:
//   - ORDERS_PAID      → /api/webhooks/shopify/order
//                        filter: "discount_codes.code:GG*"
//                        Registered in both custom and public mode.
//   - APP_UNINSTALLED  → /api/webhooks/shopify/app-uninstalled
//                        Clears Shopify credentials when merchant uninstalls.
//                        Registered in both custom and public mode.
//
// Compliance webhooks (SHOP_REDACT, CUSTOMERS_REDACT, CUSTOMERS_DATA_REQUEST)
// CANNOT be registered via the GraphQL Admin API — this is a Shopify limitation.
// For custom apps, configure these manually in the Partner Dashboard for each app.
// For public apps, they are managed via shopify.app.toml.
//
// All registrations use shopifyGraphQLWithRefresh so stale tokens are
// refreshed automatically rather than silently failing.

import { shopifyGraphQLWithRefresh } from '@/lib/shopify/shopifyGraphQl';
import { isCustomAppMode } from '@/lib/shopify/appMode';

interface WebhookRegistrationResult {
  success: boolean;
  topic: string;
  reason?: string;
}

interface RegisterWebhooksResult {
  allSucceeded: boolean;
  results: WebhookRegistrationResult[];
}

// Webhooks registered in custom mode.
// NOTE: Compliance topics (SHOP_REDACT, CUSTOMERS_REDACT, CUSTOMERS_DATA_REQUEST)
// cannot be registered via the GraphQL Admin API — Shopify only allows them to be
// configured via the Partner Dashboard or TOML. For custom apps, configure these
// manually in the Partner Dashboard for each app.
const CUSTOM_MODE_TOPICS: Array<{ topic: string; path: string; filter?: string }> = [
  {
    topic: 'ORDERS_PAID',
    path: '/api/webhooks/shopify/order',
    filter: 'discount_codes.code:GG*',
  },
  {
    topic: 'APP_UNINSTALLED',
    path: '/api/webhooks/shopify/app-uninstalled',
  },
];

// Webhooks registered in public mode (compliance handled by TOML)
const PUBLIC_MODE_TOPICS: Array<{ topic: string; path: string; filter?: string }> = [
  {
    topic: 'ORDERS_PAID',
    path: '/api/webhooks/shopify/order',
    filter: 'discount_codes.code:GG*',
  },
  {
    topic: 'APP_UNINSTALLED',
    path: '/api/webhooks/shopify/app-uninstalled',
  },
];

const SUBSCRIPTION_MUTATION = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        filter
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function registerSingleWebhook(
  clientId: string,
  shopDomain: string,
  accessToken: string,
  tokenExpiresAt: Date | undefined,
  topic: string,
  callbackPath: string,
  filter?: string
): Promise<WebhookRegistrationResult> {
  const callbackUrl = `${process.env.NEXT_PUBLIC_SHOPIFY_WEBHOOK_BASE_URL}${callbackPath}`;

  const webhookSubscription: Record<string, unknown> = {
    callbackUrl,
    format: 'JSON',
    ...(filter && { filter }),
  };

  const result = await shopifyGraphQLWithRefresh(
    clientId,
    shopDomain,
    accessToken,
    tokenExpiresAt,
    SUBSCRIPTION_MUTATION,
    { topic, webhookSubscription }
  );

  if (result.refreshFailed) {
    return { success: false, topic, reason: `Token refresh failed: ${result.refreshFailed}` };
  }

  if (!result.ok) {
    return { success: false, topic, reason: `HTTP ${result.status}` };
  }

  if (result.json?.errors) {
    return { success: false, topic, reason: result.json.errors[0]?.message ?? 'GraphQL error' };
  }

  const userErrors = result.json?.data?.webhookSubscriptionCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    const messages = userErrors.map((e: { message: string }) => e.message).join(', ');
    // Already registered is not an error — safe to re-register on reinstall
    if (messages.toLowerCase().includes('already')) {
      return { success: true, topic };
    }
    return { success: false, topic, reason: messages };
  }

  return { success: true, topic };
}

/**
 * Register required webhooks for a shop via GraphQL.
 *
 * Custom mode: registers all 4 topics (ORDERS_PAID + compliance).
 * Public mode: registers ORDERS_PAID only — compliance webhooks are
 *   managed by shopify.app.toml in public mode.
 *
 * Safe to call on reinstall — "already exists" errors are treated as success.
 */
export async function registerWebhooksViaGraphQL(
  shopDomain: string,
  accessToken: string,
  clientId: string,
  tokenExpiresAt?: Date
): Promise<RegisterWebhooksResult> {
  const topics = isCustomAppMode() ? CUSTOM_MODE_TOPICS : PUBLIC_MODE_TOPICS;

  const results = await Promise.all(
    topics.map(({ topic, path, filter }) =>
      registerSingleWebhook(clientId, shopDomain, accessToken, tokenExpiresAt, topic, path, filter)
    )
  );

  const allSucceeded = results.every((r) => r.success);

  if (!allSucceeded) {
    const failures = results.filter((r) => !r.success);
    console.error('[registerWebhooksViaGraphQL] Some webhooks failed to register:', failures);
  } else {
    console.log(`[registerWebhooksViaGraphQL] All webhooks registered for ${shopDomain}`);
  }

  return { allSucceeded, results };
}