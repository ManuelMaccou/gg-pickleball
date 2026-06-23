// lib/shopify/createShopifyDiscountCode.ts

import { ClientSession, Types } from 'mongoose';
import Reward from '@/app/models/Reward';
import Client from '@/app/models/Client';
import crypto from 'crypto';
import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

const SHOPIFY_API_VERSION = '2025-10';

interface GeneratorOptions {
  session: ClientSession;
}

async function getValidAccessToken(
  clientId: Types.ObjectId
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

  if (!client?.shopify?.shopDomain || !client?.shopify?.accessToken) {
    return null;
  }

  // No active plan — treat the same as missing credentials so the auth error
  // path fires and the player sees the "achievements saved" dialog rather than
  // silently getting a discount code from a store that's no longer paying.
  if (!client.shopify.hasActivePlan) {
    console.warn(
      `[createShopifyDiscountCode] Client ${clientId} has no active Shopify plan — ` +
      `skipping discount code creation. Merchant must select a plan.`
    );
    return null;
  }

  // Proactive refresh if token is near expiry
  if (tokenNeedsRefresh(client.shopify.tokenExpiresAt)) {
    console.log(`[createShopifyDiscountCode] Token near expiry for client ${clientId} — refreshing`);
    const refreshResult = await refreshShopifyToken(clientId.toString());
    if (refreshResult.success && refreshResult.accessToken) {
      return { shopDomain: client.shopify.shopDomain, accessToken: refreshResult.accessToken };
    }
    console.error(`[createShopifyDiscountCode] Proactive refresh failed for client ${clientId}`);
    // Fall through and try with the existing token — it might still work
  }

  return { shopDomain: client.shopify.shopDomain, accessToken: client.shopify.accessToken };
}

export async function createShopifyDiscountCode(
  rewardId: Types.ObjectId,
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<string | null> {
  const { session } = options;

  const reward = await Reward.findById(rewardId).session(session);
  if (!reward) throw new Error(`Reward not found for ID: ${rewardId}`);

  // Get a valid token — outside the session to allow token writes if needed
  let credentials = await getValidAccessToken(clientId);
  if (!credentials) {
    throw new Error(`Client or Shopify credentials missing for reward ${rewardId}`);
  }

  const discountTitle =
    (reward.friendlyName?.trim() || '') + ' ' + (reward.product?.trim() || '');
  const cleanTitle = discountTitle.trim() || 'Discount Reward';
  const discountType = reward.type ?? 'dollars';
  const discountValue = reward.discount ?? 0;
  const minimumSpend = reward.minimumSpend ?? null;

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 6);
    const code = `GG${randomPart}`;

    const basicCodeDiscountInput = {
      appliesOncePerCustomer: true,
      code,
      title: cleanTitle,
      startsAt: new Date().toISOString(),
      customerSelection: { all: true },
      customerGets: {
        items: { all: true },
        value:
          discountType === 'percent'
            ? { percentage: discountValue / 100 }
            : {
                discountAmount: {
                  amount: String(discountValue),
                  appliesOnEachItem: false,
                },
              },
      },
      minimumRequirement: minimumSpend
        ? { subtotal: { greaterThanOrEqualToSubtotal: String(minimumSpend) } }
        : null,
      usageLimit: 1,
    };

    const graphqlQuery = {
      query: `
        mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  status
                  codes(first: 1) {
                    nodes { code }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: { basicCodeDiscount: basicCodeDiscountInput },
    };

    try {
      const response = await fetch(
        `https://${credentials.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': credentials.accessToken,
          },
          body: JSON.stringify(graphqlQuery),
        }
      );

      // ── 401 — attempt token refresh and retry once ────────────────────
      if (response.status === 401) {
        console.log(`[createShopifyDiscountCode] 401 — refreshing token for client ${clientId}`);
        const refreshResult = await refreshShopifyToken(clientId.toString());
        if (refreshResult.success && refreshResult.accessToken) {
          credentials = { shopDomain: credentials.shopDomain, accessToken: refreshResult.accessToken };
          attempts--;
          continue;
        }
        throw new Error(`Shopify API HTTP Error (401): Token refresh failed — merchant must reconnect Shopify`);
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`Shopify API HTTP Error (${response.status}):`, text);
        throw new Error(`Shopify API HTTP Error (${response.status}): ${text}`);
      }

      const json = await response.json();
      const userErrors = json.data?.discountCodeBasicCreate?.userErrors;

      if (userErrors && userErrors.length > 0) {
        const isDuplicate = userErrors.some(
          (e: any) =>
            e.message.toLowerCase().includes('taken') ||
            e.message.toLowerCase().includes('exists')
        );

        if (isDuplicate) {
          console.warn(`Code collision for ${code}, retrying... (Attempt ${attempts}/${MAX_ATTEMPTS})`);
          continue;
        } else {
          console.error('Shopify User Errors:', JSON.stringify(userErrors, null, 2));
          throw new Error(`Shopify Discount Error: ${userErrors[0].message}`);
        }
      }

      if (json.errors) {
        console.error('Shopify System Errors:', JSON.stringify(json.errors, null, 2));
        throw new Error(`Shopify System Error: ${json.errors[0].message}`);
      }

      return code;
    } catch (err) {
      console.error('Shopify Request Failed:', err);
      throw err;
    }
  }

  throw new Error(`Failed to generate unique Shopify code after ${MAX_ATTEMPTS} attempts.`);
}