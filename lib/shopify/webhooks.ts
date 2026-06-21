import { shopifyGraphQLWithRefresh } from '@/lib/shopify/shopifyGraphQl';

interface WebhookRegistrationResult {
  success: boolean;
  reason?: string;
}

export async function registerOrderPaidWebhook(
  clientId: string,
  shopDomain: string,
  accessToken: string,
  tokenExpiresAt?: Date
): Promise<WebhookRegistrationResult> {
  const callbackUrl = `${process.env.NEXT_PUBLIC_SHOPIFY_WEBHOOK_BASE_URL}/api/webhooks/shopify/order`;

  const query = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          filter
          uri
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    topic: "ORDERS_PAID",
    webhookSubscription: {
      callbackUrl: callbackUrl,
      format: "JSON",
      filter: "discount_codes.code:GG*"
    }
  };

  const result = await shopifyGraphQLWithRefresh(
    clientId,
    shopDomain,
    accessToken,
    tokenExpiresAt,
    query,
    variables
  );

  if (result.refreshFailed) {
    console.error(`[Webhook] Token refresh failed for client ${clientId}: ${result.refreshFailed}`);
    return { success: false, reason: `Token refresh failed: ${result.refreshFailed}` };
  }

  if (!result.ok) {
    console.error(`[Webhook] GraphQL call failed (${result.status}):`, result.json);
    return { success: false, reason: `HTTP ${result.status}` };
  }

  if (result.json?.errors) {
    console.error('[Webhook] GraphQL errors:', result.json.errors);
    return { success: false, reason: result.json.errors[0]?.message ?? 'GraphQL error' };
  }

  const userErrors = result.json?.data?.webhookSubscriptionCreate?.userErrors;
  if (userErrors?.length > 0) {
    console.error("[Webhook] Registration failed:", userErrors);
    return { success: false, reason: userErrors[0]?.message ?? 'Registration failed' };
  }

  console.log("✅ Webhook ORDERS_PAID registered successfully", result.json.data.webhookSubscriptionCreate.webhookSubscription);
  return { success: true };
}