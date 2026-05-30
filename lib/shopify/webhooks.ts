export async function registerOrderPaidWebhook(shopDomain: string, accessToken: string) {
  const callbackUrl = `${process.env.NEXT_PUBLIC_SHOPIFY_WEBHOOK_BASE_URL}/api/webhooks/shopify/order`;
  const SHOPIFY_API_VERSION = "2025-10";

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

  const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Webhook] GraphQL call failed (${response.status}):`, body);
    return;
  }

  const json = await response.json();
  
  if (json.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
    console.error("Webhook Registration Failed:", json.data.webhookSubscriptionCreate.userErrors);
    // Don't throw, just log. The app install shouldn't fail if webhook reg fails (we can retry later).
  } else {
    console.log("✅ Webhook ORDERS_PAID registered successfully", json.data.webhookSubscriptionCreate.webhookSubscription);
  }
}