// Destination: lib/shopify/createShopifyDiscountCode.ts

import { ClientSession, Types } from 'mongoose';
import Reward from '@/app/models/Reward';
import crypto from 'crypto';
import { refreshShopifyToken } from './refreshShopifyToken';
import { getValidShopifyCredentials } from './getValidShopifyCredentials';
import { buildDiscountItemsInput, buildCombinesWithInput } from './buildDiscountItemsInput';

const SHOPIFY_API_VERSION = '2025-10';

interface GeneratorOptions {
  session: ClientSession;
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
  let credentials = await getValidShopifyCredentials(clientId);
  if (!credentials) {
    throw new Error(`Client or Shopify credentials missing for reward ${rewardId}`);
  }

  const discountTitle =
    (reward.friendlyName?.trim() || '') + ' ' + (reward.product?.trim() || '');
  const cleanTitle = discountTitle.trim() || 'Discount Reward';
  const discountType = reward.type ?? 'dollars';
  const discountValue = reward.discount ?? 0;
  const minimumSpend = reward.minimumSpend ?? null;

  // Entire store when no scope is stored at all — covers every reward
  // created before scoped discounts existed, and any reward that never
  // set shopifyTargeting for some other reason.
  const itemsInput = buildDiscountItemsInput(reward.shopifyTargeting ?? { all: true });
  const combinesWith = buildCombinesWithInput(reward.combinesWithOtherDiscounts ?? false);

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
      context: { all: "ALL" },
      combinesWith,
      customerGets: {
        items: itemsInput,
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
      const requestUrl = `https://${credentials.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
      const response = await fetch(
        requestUrl,
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
        // A clean HTTP 404 here (as opposed to a 401/403, or a 200 with a
        // GraphQL userErrors/errors body) almost always means the URL
        // itself was wrong — most commonly shopDomain being stored as the
        // store's custom/public domain instead of its actual
        // *.myshopify.com domain, which Shopify's Admin API requires.
        // Logging the exact URL here since the response body alone
        // ({"errors":"Not Found"}) gives no way to tell.
        console.error(`[createShopifyDiscountCode] Shopify API HTTP Error (${response.status}) for client ${clientId}. Requested URL: ${requestUrl}. Response body:`, text);
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