import { ClientSession, Types } from 'mongoose';
import Reward from '@/app/models/Reward';
import Client from '@/app/models/Client';
import crypto from 'crypto';

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

  const client = await Client.findById(clientId).session(session);
  if (!client || !client.shopify.accessToken || !client.shopify.shopDomain) {
    throw new Error(`Client or Shopify credentials missing for reward ${rewardId}`);
  }

  const discountTitle = (reward.friendlyName?.trim() || '') + ' ' + (reward.product?.trim() || '');
  const cleanTitle = discountTitle.trim() || 'Discount Reward';
  const discountType = reward.type ?? 'dollars';
  const discountValue = reward.discount ?? 0; 
  const minimumSpend = reward.minimumSpend ?? null;

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    // Generate Code (GG + 6 Hex Chars)
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 6); 
    const code = `GG${randomPart}`;

    const basicCodeDiscountInput = {
      appliesOncePerCustomer: true,
      code,
      title: cleanTitle,
      startsAt: new Date().toISOString(),
    customerSelection: {
      all: true,
    },
      customerGets: {
        appliesOnSubscription: false,
      items: {
        all: true,
      },
        value: discountType === 'percent'
          ? { percentage: discountValue / 100 }
          : { 
              discountAmount: { 
                amount: String(discountValue), 
                appliesOnEachItem: false 
              } 
            },
      },
      minimumRequirement: minimumSpend
      ? {
          subtotal: {
            greaterThanOrEqualToSubtotal: String(minimumSpend) // Must be String for Decimal
          }
        }
      : null, // Explicit null if no minimum
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
                codes(first:1) {
                  nodes {
                    code
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
    variables: {
      basicCodeDiscount: basicCodeDiscountInput
    }
    };

    try {
        const response = await fetch(`https://${client.shopify.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': client.shopify.accessToken,
            },
            body: JSON.stringify(graphqlQuery),
        });

        if (!response.ok) {
            const text = await response.text();
             console.error(`Shopify API HTTP Error (${response.status}):`, text);
            throw new Error(`Shopify API HTTP Error (${response.status}): ${text}`);
        }

        const json = await response.json();
        const userErrors = json.data?.discountCodeBasicCreate?.userErrors;

        if (userErrors && userErrors.length > 0) {
            // Check if error is specifically about duplicate code
            const isDuplicate = userErrors.some((e: any) => e.message.toLowerCase().includes('taken') || e.message.toLowerCase().includes('exists'));
            
            if (isDuplicate) {
                console.warn(`Code collision for ${code}, retrying... (Attempt ${attempts}/${MAX_ATTEMPTS})`);
                continue; // Retry loop
            } else {
                // Other business error (e.g. invalid value)
                console.error('Shopify User Errors:', JSON.stringify(userErrors, null, 2));
                throw new Error(`Shopify Discount Error: ${userErrors[0].message}`);
            }
        }

        if (json.errors) {
            console.error('Shopify System Errors:', JSON.stringify(json.errors, null, 2));
            throw new Error(`Shopify System Error: ${json.errors[0].message}`);
        }

        // Success!
        return code;

    } catch (err) {
        console.error("Shopify Request Failed:", err);
        throw err;
    }
  }

  throw new Error(`Failed to generate unique Shopify code after ${MAX_ATTEMPTS} attempts.`);
}