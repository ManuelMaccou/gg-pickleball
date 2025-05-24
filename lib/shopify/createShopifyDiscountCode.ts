import { Types } from 'mongoose';
import Reward from '@/app/models/Reward';
import Client from '@/app/models/Client';
import crypto from 'crypto';

const SHOPIFY_API_VERSION = '2025-04';

export async function createShopifyDiscountCode(rewardId: Types.ObjectId, clientId: Types.ObjectId): Promise<string | null> {
  const reward = await Reward.findById(rewardId);
  if (!reward) {
    throw new Error(`Reward not found for ID: ${rewardId}`);
  }

  const client = await Client.findById(clientId);
  if (!client || !client.shopify.accessToken || !client.shopify.shopDomain) {
    throw new Error(`Client or Shopify credentials missing for reward ${rewardId}`);
  }

  const code = crypto.randomBytes(6)
  .toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .substring(0, 6)
  .toUpperCase();

  const discountTitle =
    (reward.friendlyName?.trim() || '') + ' ' + (reward.product?.trim() || '');
  const cleanTitle = discountTitle.trim() || 'Discount Reward';

  const input = {
    basicCodeDiscount: {
      title: cleanTitle,
      code,
      startsAt: new Date().toISOString(),
      customerSelection: {
        all: true,
      },
      customerGets: {
        value: reward.type === 'percent'
          ? { percentage: reward.discount/100 }
          : { discountAmount: { amount: reward.discount, appliesOnEachItem: false } },
        appliesOnOneTimePurchase: true,
        appliesOnSubscription: false,
        items: {
          all: true,
        },
      },
      appliesOncePerCustomer: true,
      usageLimit: 1,
    }
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
                customerSelection {
                  ... on DiscountCustomers {
                    customers {
                      id
                    }
                  }
                }
                customerGets {
                  value {
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                      }
                    }
                  }
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
    variables: input
  };

  console.log('client details on createShopifyDiscountCode:', client)

  const response = await fetch(`https://${client.shopify.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': client.shopify.accessToken,
    },
    body: JSON.stringify(graphqlQuery),
  });

  const json = await response.json();

  if (json.errors || json.data?.discountCodeBasicCreate?.userErrors?.length) {
    console.error('Shopify error:', JSON.stringify(json, null, 2));
    throw new Error(`Shopify returned an error when creating discount code`);
  }

  return code;
}
