// app/api/webhooks/shopify/app-uninstalled/route.ts
//
// Fires immediately when a merchant uninstalls the app from their Shopify admin.
// Clears Shopify credentials from the Client record so the app knows the
// integration is no longer active.
//
// Registered via GraphQL at OAuth time (APP_UNINSTALLED topic) in both
// custom and public mode.
//
// What we clear:
//   - accessToken, refreshToken, tokenExpiresAt, refreshTokenExpiresAt
//   - hasActivePlan → false (stops discount code generation)
//
// What we keep:
//   - shopDomain, shopId, envKey — needed to identify the client if they reinstall
//   - All commission records — billing history is preserved regardless

import { verifyAndReadWebhook } from '@/lib/shopify/verifyWebhookHmac';
import { logError } from '@/lib/sentry/logger';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';

export async function POST(req: Request): Promise<Response> {
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  if (!shopDomain) {
    console.warn('[AppUninstalled] Missing x-shopify-shop-domain header');
    return new Response('Bad Request', { status: 400 });
  }

  console.log(`[AppUninstalled] Received webhook for ${shopDomain}`);

  // Verify HMAC before doing anything
  const body = await verifyAndReadWebhook(req);
  if (!body) {
    console.warn(`[AppUninstalled] HMAC verification failed for ${shopDomain}`);
    return new Response('Unauthorized', { status: 401 });
  }

  console.log(`[AppUninstalled] HMAC verified for ${shopDomain}`);

  try {
    await connectToDatabase();
    console.log(`[AppUninstalled] DB connected — searching for client with shopDomain: ${shopDomain}`);

    const client = await Client.findOne({ 'shopify.shopDomain': shopDomain }).lean() as any;

    if (!client) {
      console.log(`[AppUninstalled] No client found for shopDomain: ${shopDomain} — nothing to clear`);
      return new Response('OK', { status: 200 });
    }

    console.log(
      `[AppUninstalled] Found client: ${client._id} (${client.name}) — ` +
      `current accessToken: ${client.shopify?.accessToken ? 'present' : 'already missing'}, ` +
      `hasActivePlan: ${client.shopify?.hasActivePlan}`
    );

    const result = await Client.findByIdAndUpdate(
      client._id,
      {
        $unset: {
          'shopify.accessToken': '',
          'shopify.refreshToken': '',
          'shopify.tokenExpiresAt': '',
          'shopify.refreshTokenExpiresAt': '',
        },
        $set: {
          'shopify.hasActivePlan': false,
          'shopify.uninstalledAt': new Date(),
        },
      },
      { new: true }
    ).lean() as any;

    console.log(
      `[AppUninstalled] ✅ Update complete for client ${client._id} (${client.name}) — ` +
      `accessToken after update: ${result?.shopify?.accessToken ? 'still present (unexpected)' : 'cleared'}, ` +
      `hasActivePlan: ${result?.shopify?.hasActivePlan}, ` +
      `uninstalledAt: ${result?.shopify?.uninstalledAt}`
    );

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error(`[AppUninstalled] ❌ Error processing uninstall for ${shopDomain}:`, err);
    logError(err, {
      endpoint: 'POST /api/webhooks/shopify/app-uninstalled',
      shopDomain,
    });
    return new Response('OK', { status: 200 });
  }
}