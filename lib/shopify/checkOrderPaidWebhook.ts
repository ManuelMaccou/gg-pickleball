// lib/shopify/checkOrderPaidWebhook.ts
//
// Checks whether the ORDERS_PAID webhook with the GG discount code filter
// is registered for a given shop. Used by the client-status route to surface
// missing webhook warnings in the GG admin dashboard.

import { shopifyGraphQLWithRefresh } from '@/lib/shopify/shopifyGraphQl';

export async function checkOrderPaidWebhookExists(
  clientId: string,
  shopDomain: string,
  accessToken: string,
  tokenExpiresAt?: Date
): Promise<'registered' | 'missing' | 'unknown'> {
  const query = `
    {
      webhookSubscriptions(first: 20, topics: [ORDERS_PAID]) {
        edges { node { id topic filter } }
      }
    }
  `;
  const result = await shopifyGraphQLWithRefresh(clientId, shopDomain, accessToken, tokenExpiresAt, query);
  if (result.refreshFailed || !result.ok || result.json?.errors) return 'unknown';
  const edges = result.json?.data?.webhookSubscriptions?.edges ?? [];
  const hasOurWebhook = edges.some((e: any) => e.node?.filter === 'discount_codes.code:GG*');
  return hasOurWebhook ? 'registered' : 'missing';
}