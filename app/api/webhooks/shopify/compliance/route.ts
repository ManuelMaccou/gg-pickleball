// app/api/webhooks/shopify/compliance/route.ts
//
// Mandatory Shopify compliance webhooks required for app store listing.
// Handles three topics sent to a single endpoint via the X-Shopify-Topic header:
//
//   customers/data_request  — A customer requested their data. You must email
//                             them what data you hold within 30 days.
//   customers/redact        — A customer requested deletion. You must delete
//                             their data within 30 days.
//   shop/redact             — A merchant uninstalled your app. You must delete
//                             all their shop data within 48 hours.
//
// All three return 200 immediately to acknowledge receipt. The actual
// data handling is logged here and should be acted on manually or via
// a queue. At your current scale (5 clients), manual handling is fine.

import { verifyAndReadWebhook } from '@/lib/shopify/verifyWebhookHmac';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: Request): Promise<Response> {
  const topic = req.headers.get('x-shopify-topic');
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  // Verify HMAC before doing anything else.
  const body = await verifyAndReadWebhook(req);
  if (!body) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  console.log(`[Shopify Compliance] Received topic: ${topic} from ${shopDomain}`);

  try {
    switch (topic) {
      case 'customers/data_request': {
        const customer = payload.customer as { id?: number; email?: string; phone?: string } | undefined;
        const orders = payload.orders_requested as number[] | undefined;
        console.log(
          `[Shopify Compliance] DATA REQUEST — shop: ${shopDomain}, ` +
          `customer: ${customer?.email} (${customer?.id}), ` +
          `orders: ${orders?.join(', ')}. ` +
          `Manual action required: email customer their data within 30 days.`
        );
        break;
      }

      case 'customers/redact': {
        const customer = payload.customer as { id?: number; email?: string } | undefined;
        const ordersToRedact = payload.orders_to_redact as number[] | undefined;
        console.log(
          `[Shopify Compliance] CUSTOMER REDACT — shop: ${shopDomain}, ` +
          `customer: ${customer?.email} (${customer?.id}), ` +
          `orders to redact: ${ordersToRedact?.join(', ')}. ` +
          `Manual action required: delete customer data within 30 days.`
        );
        break;
      }

      case 'shop/redact': {
        const shopId = payload.shop_id as number | undefined;
        console.log(
          `[Shopify Compliance] SHOP REDACT — shop: ${shopDomain} (${shopId}). ` +
          `Manual action required: delete all shop data within 48 hours.`
        );
        break;
      }

      default:
        console.warn(`[Shopify Compliance] Unknown topic: ${topic}`);
    }
  } catch (err) {
    logError(err, { endpoint: 'POST /api/webhooks/shopify/compliance', topic, shopDomain });
    // Still return 200 — Shopify will retry on non-200 responses and
    // compliance webhooks must always acknowledge receipt.
  }

  return new Response('OK', { status: 200 });
}