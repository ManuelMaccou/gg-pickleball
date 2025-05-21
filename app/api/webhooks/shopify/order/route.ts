import crypto from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { ShopifyOrder } from '@/app/types/shopify';
import { redeemDiscountCode } from '@/lib/rewards/redeemDiscountCodes';

type DiscountCode = { code: string };

export async function POST(req: Request): Promise<Response> {
  const shopDomain = req.headers.get('x-shopify-shop-domain');
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

  if (!shopDomain || !hmacHeader) {
    console.warn('❌ Missing required Shopify headers');
    return new Response('Missing headers', { status: 400 });
  }

  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  await connectToDatabase();
  const client = await Client.findOne({ 'shopify.shopDomain': shopDomain });

  const clientSecret = client?.shopify?.secret;
  if (!clientSecret) {
    console.warn(`❌ Missing secret for client ${client?.name || shopDomain}`);
    return new Response('Unauthorized', { status: 401 });
  }

  // ✅ Critical Fix: Use raw buffer, not string
  const calculatedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(bodyBuffer) // ✅ Shopify signs raw bytes
    .digest('base64');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(calculatedHmac, 'base64'),
    Buffer.from(hmacHeader, 'base64')
  );

  if (!isValid) {
    console.warn('❌ Invalid HMAC');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const bodyString = bodyBuffer.toString('utf8');
    const payload = JSON.parse(bodyString);

   const discountCodes: string[] =
    Array.isArray(payload.discount_codes) &&
    payload.discount_codes.every(
      (code: unknown): code is DiscountCode =>
        typeof code === 'object' &&
        code !== null &&
        'code' in code &&
        typeof (code as Record<string, unknown>).code === 'string'
    )
      ? payload.discount_codes.map((dc: DiscountCode) => dc.code)
      : [];

    if (discountCodes.length === 0) {
      console.log('🚫 Ignoring order with no discount codes.');
      return new Response('No discount codes', { status: 200 });
    }

    const extractedOrder: ShopifyOrder = {
      id: String(payload.id),
      admin_graphql_api_id: String(payload.admin_graphql_api_id),
      app_id: String(payload.app_id ?? ''),
      discount_codes: discountCodes,
      order_number: Number(payload.order_number),
      customer: {
        id: String(payload.customer?.id),
      },
      location_id: String(payload.location_id ?? ''),
      merchant_business_entity_id: String(payload.merchant_business_entity_id ?? ''),
    };

    console.log('✅ Extracted Shopify Order:', extractedOrder);
    await redeemDiscountCode(discountCodes);

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Error parsing or processing webhook payload:', err);
    return new Response('Bad Request', { status: 400 });
  }
}
