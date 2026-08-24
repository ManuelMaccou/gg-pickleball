// lib/shopify/getValidShopifyCredentials.ts
import { Types } from 'mongoose';
import Client from '@/app/models/Client';
import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

export async function getValidShopifyCredentials(
  clientId: Types.ObjectId | string
): Promise<{ shopDomain: string; accessToken: string } | null> {
  const client = await Client.findById(clientId)
    .select('shopify.shopDomain shopify.accessToken shopify.tokenExpiresAt shopify.refreshToken shopify.hasActivePlan')
    .lean() as {
      shopify?: {
        shopDomain?: string;
        accessToken?: string;
        tokenExpiresAt?: Date;
        refreshToken?: string;
        hasActivePlan?: boolean;
      };
    } | null;

  if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) return null;

  if (!client.shopify.hasActivePlan) {
    console.warn(`[getValidShopifyCredentials] Client ${clientId} has no active Shopify plan.`);
    return null;
  }

  if (tokenNeedsRefresh(client.shopify.tokenExpiresAt)) {
    const refreshResult = await refreshShopifyToken(clientId.toString());
    if (refreshResult.success && refreshResult.accessToken) {
      return { shopDomain: client.shopify.shopDomain, accessToken: refreshResult.accessToken };
    }
    console.error(`[getValidShopifyCredentials] Proactive refresh failed for client ${clientId}`);
  }

  return { shopDomain: client.shopify.shopDomain, accessToken: client.shopify.accessToken };
}