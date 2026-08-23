// Destination: lib/shopify/createShopifyBxgyDiscountCode.ts

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

export async function createShopifyBxgyDiscountCode(
  rewardId: Types.ObjectId,
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<string | null> {
  const { session } = options;

  const reward = await Reward.findById(rewardId).session(session);
  if (!reward) throw new Error(`Reward not found for ID: ${rewardId}`);
  if (!reward.bxgy) {
    throw new Error(`Reward ${rewardId} has discountKind 'bxgy' but no bxgy config — data is inconsistent.`);
  }

  let credentials = await getValidShopifyCredentials(clientId);
  if (!credentials) {
    throw new Error(`Client or Shopify credentials missing for reward ${rewardId}`);
  }

  const cleanTitle = reward.friendlyName?.trim() || 'Buy X Get Y Reward';
  const combinesWith = buildCombinesWithInput(reward.combinesWithOtherDiscounts ?? false);

  // No "all" option exists on either side of a BXGY discount in Shopify's
  // schema — buys/gets are always specific products and/or collections,
  // enforced upstream by the admin form, not re-checked here.
  const buysItems = buildDiscountItemsInput(reward.bxgy.buys ?? {});
  const getsItems = buildDiscountItemsInput(reward.bxgy.gets ?? {});
  const getPercent = reward.bxgy.getPercent ?? 100;

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 6);
    const code = `GG${randomPart}`;

    const bxgyCodeDiscountInput = {
      code,
      context: { all: "ALL" },
      title: cleanTitle,
      startsAt: new Date().toISOString(),
      combinesWith,
      // Confirmed against the DiscountCodeBxgy object schema: both fields
      // are Int, and distinct — usageLimit caps total redemptions across
      // every customer (matches the amount-off path's single-use code
      // model), usesPerOrderLimit caps repeats within one order.
      usageLimit: 1,
      usesPerOrderLimit: 1,
      customerBuys: {
        items: buysItems,
        // Quantity is a String on this input despite looking numeric —
        // matches Shopify's own documented example payloads for both the
        // automatic and code-based BXGY mutations.
        value: { quantity: "1"},
      },
      customerGets: {
        items: getsItems,
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: { percentage: getPercent / 100 },
          },
        },
      },
    };

    const graphqlQuery = {
      query: `
        mutation CreateBxgyDiscountCode($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
          discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBxgy {
                  title
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
      variables: { bxgyCodeDiscount: bxgyCodeDiscountInput },
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

      if (response.status === 401) {
        console.log(`[createShopifyBxgyDiscountCode] 401 — refreshing token for client ${clientId}`);
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
      const userErrors = json.data?.discountCodeBxgyCreate?.userErrors;

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

  throw new Error(`Failed to generate unique Shopify BXGY code after ${MAX_ATTEMPTS} attempts.`);
}