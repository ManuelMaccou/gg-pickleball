// app/api/webhooks/shopify/order/route.ts

import { verifyAndReadWebhook } from '@/lib/shopify/verifyWebhookHmac';
import { redeemDiscountCode } from '@/lib/rewards/redeemDiscountCodes';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: Request): Promise<Response> {
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  if (!shopDomain) {
    console.warn('❌ Missing x-shopify-shop-domain header');
    return new Response('Missing headers', { status: 400 });
  }

  // Verify HMAC and read body in one call.
  const body = await verifyAndReadWebhook(req);
  if (!body) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload = JSON.parse(body.toString('utf8'));

    const discountCodes: string[] = (payload.discount_codes || [])
      .map((dc: any) => dc?.code)
      .filter((code: any): code is string => typeof code === 'string');

    if (discountCodes.length === 0) {
      return new Response('No discount codes', { status: 200 });
    }

    console.log(`✅ Processing Order from ${shopDomain} with codes:`, discountCodes);

    const shopifyOrderId = String(payload.id);
    const orderContext = {
      shopifyOrderId,
      shopifyOrderGid: `gid://shopify/Order/${shopifyOrderId}`,
      shopDomain,
      orderTotal: parseFloat(payload.total_price ?? '0'),
      orderCreatedAt: new Date(payload.created_at),
    };

    await redeemDiscountCode(discountCodes, orderContext);

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Error processing order webhook:', err);
    const errorId = logError(err, { endpoint: 'POST /api/webhooks/shopify/order' });
    return new Response(JSON.stringify({ errorId, error: 'Error' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
}
