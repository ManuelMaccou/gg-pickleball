// app/api/webhooks/shopify/compliance/route.ts
//
// Mandatory Shopify compliance webhooks required for app store listing.
//
//   customers/data_request  — Customer requested their data. Must respond
//                             within 30 days. Creates a ComplianceRequest
//                             record for manual fulfillment via GG admin.
//   customers/redact        — Customer requested deletion. Must delete
//                             within 30 days. Creates a ComplianceRequest
//                             record for manual fulfillment via GG admin.
//   shop/redact             — Merchant uninstalled 48+ hours ago. Shopify
//                             requires deletion of all shop and customer data
//                             within 48 hours of this webhook firing.
//                             Credentials are already cleared by app/uninstalled.
//                             This creates a ComplianceRequest for manual review
//                             of any remaining personal data (e.g. order records,
//                             commission history, customer emails in RewardCodes).

import { verifyAndReadWebhook } from '@/lib/shopify/verifyWebhookHmac';
import { logError } from '@/lib/sentry/logger';
import connectToDatabase from '@/lib/mongodb';
import ComplianceRequest from '@/app/models/ComplianceRequest';

export async function POST(req: Request): Promise<Response> {
  const topic = req.headers.get('x-shopify-topic');
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  // Verify HMAC before doing anything else.
  const body = await verifyAndReadWebhook(req);
  if (!body) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!topic || !shopDomain) {
    return new Response('Bad Request', { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  console.log(`[Shopify Compliance] Received topic: ${topic} from ${shopDomain}`);

  try {
    await connectToDatabase();

    switch (topic) {

      // ── Customer data request ──────────────────────────────────────────────
      // Shopify requires you to email the customer their data within 30 days.
      // We store a record visible in GG admin for manual fulfillment.
      case 'customers/data_request': {
        const customer = payload.customer as { id?: number; email?: string; phone?: string } | undefined;
        const orders = payload.orders_requested as number[] | undefined;

        await ComplianceRequest.create({
          topic: 'customers/data_request',
          shopDomain,
          customerId: customer?.id,
          customerEmail: customer?.email,
          ordersReferenced: orders ?? [],
          status: 'pending',
          receivedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          notes: `Customer data request. Email ${customer?.email} their data within 30 days.`,
        });

        console.log(
          `[Shopify Compliance] DATA REQUEST logged — shop: ${shopDomain}, ` +
          `customer: ${customer?.email} (${customer?.id}). Due within 30 days.`
        );
        break;
      }

      // ── Customer redact ────────────────────────────────────────────────────
      // Shopify requires you to delete the customer's data within 30 days.
      // We store a record visible in GG admin for manual fulfillment.
      case 'customers/redact': {
        const customer = payload.customer as { id?: number; email?: string } | undefined;
        const ordersToRedact = payload.orders_to_redact as number[] | undefined;

        await ComplianceRequest.create({
          topic: 'customers/redact',
          shopDomain,
          customerId: customer?.id,
          customerEmail: customer?.email,
          ordersReferenced: ordersToRedact ?? [],
          status: 'pending',
          receivedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          notes: `Customer redact request. Delete all data for ${customer?.email} within 30 days.`,
        });

        console.log(
          `[Shopify Compliance] CUSTOMER REDACT logged — shop: ${shopDomain}, ` +
          `customer: ${customer?.email} (${customer?.id}). Due within 30 days.`
        );
        break;
      }

      // ── Shop redact ────────────────────────────────────────────────────────
      // Fires 48 hours after the merchant uninstalls. By this point, Shopify
      // credentials have already been cleared by the app/uninstalled webhook.
      //
      // This is a GDPR data deletion request — Shopify requires that all
      // personal data related to the shop and its customers be deleted within
      // 48 hours of this webhook firing.
      //
      // Data that may need manual deletion:
      //   - CommissionRecords for this shop (contain shopifyOrderId, shopDomain)
      //   - RewardCodes issued to customers of this store
      //   - StripeCustomer record for this client
      //   - Any customer emails stored in the above records
      //
      // We create a ComplianceRequest so this shows up in the GG admin
      // compliance page for manual review and deletion.
      case 'shop/redact': {
        const shopId = payload.shop_id as number | undefined;

        await ComplianceRequest.create({
          topic: 'shop/redact',
          shopDomain,
          status: 'pending',
          receivedAt: new Date(),
          dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          notes:
            `Shop redact request for ${shopDomain} (shop_id: ${shopId ?? 'unknown'}). ` +
            `Shopify credentials already cleared by app/uninstalled webhook. ` +
            `Manual action required: delete CommissionRecords, RewardCodes, and StripeCustomer ` +
            `records associated with this shop within 48 hours of this request.`,
        });

        console.log(
          `[Shopify Compliance] SHOP REDACT — ComplianceRequest created for ${shopDomain}. ` +
          `Credentials already cleared. Manual data deletion required within 48 hours.`
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