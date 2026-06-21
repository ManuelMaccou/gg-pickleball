// app/api/webhooks/stripe/route.ts
//
// Handles Stripe webhook events for commission billing (custom app mode only).
//
// Events handled:
//   invoice.paid            → Commission successfully collected. Set to 'charged'.
//   invoice.payment_failed  → Payment failed. Set to 'review' for manual follow-up.
//
// All other events are acknowledged with 200 and ignored.
//
// Stripe signature verification uses STRIPE_WEBHOOK_SECRET (from Stripe dashboard
// → Developers → Webhooks → your endpoint → Signing secret).

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import { logError } from '@/lib/sentry/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    console.warn('[StripeWebhook] Missing stripe-signature header');
    return new NextResponse('Missing signature', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET not set');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.warn(`[StripeWebhook] Signature verification failed: ${message}`);
    return new NextResponse(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  // Acknowledge immediately — Stripe requires a fast 2xx before processing
  // to avoid timeouts. We process synchronously here since our logic is simple
  // DB writes, but for complex handlers consider an async queue.

  try {
    await connectToDatabase();

    switch (event.type) {

      // ── Invoice paid — payment confirmed ────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & { payment_intent?: string };
        const invoiceId = invoice.id;

        console.log(`[StripeWebhook] invoice.paid — ${invoiceId}`);

        const records = await CommissionRecord.find({ stripeInvoiceId: invoiceId });

        if (records.length === 0) {
          console.warn(`[StripeWebhook] No commission records found for invoice ${invoiceId}`);
          break;
        }

        const now = new Date();
        for (const record of records) {
          await CommissionRecord.findByIdAndUpdate(record._id, {
            $set: {
              status: 'charged',
              holdReason: null,
              lastCheckedAt: now,
              stripePaymentIntentId: invoice.payment_intent ?? undefined,
              reviewNote: null,
            },
          });
        }

        console.log(
          `[StripeWebhook] ✅ Marked ${records.length} commission record(s) as charged — ` +
          `invoice ${invoiceId}`
        );
        break;
      }

      // ── Invoice payment failed — needs manual follow-up ──────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.id;

        console.warn(`[StripeWebhook] invoice.payment_failed — ${invoiceId}`);

        const records = await CommissionRecord.find({ stripeInvoiceId: invoiceId });

        if (records.length === 0) {
          console.warn(`[StripeWebhook] No commission records found for invoice ${invoiceId}`);
          break;
        }

        const now = new Date();
        const failureMessage =
          (invoice as any).last_payment_error?.message ?? 'Payment failed';

        for (const record of records) {
          await CommissionRecord.findByIdAndUpdate(record._id, {
            $set: {
              status: 'review',
              holdReason: null,
              lastCheckedAt: now,
              reviewNote: `Stripe payment failed — invoice ${invoiceId}: ${failureMessage}`,
            },
          });
        }

        logError(
          new Error(`Stripe invoice payment failed: ${invoiceId} — ${failureMessage}`),
          { endpoint: 'POST /api/webhooks/stripe', invoiceId }
        );

        console.error(
          `[StripeWebhook] ❌ Marked ${records.length} commission record(s) as review — ` +
          `invoice ${invoiceId}: ${failureMessage}`
        );
        break;
      }

      default:
        // Acknowledge all other events without processing
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    logError(err, { endpoint: 'POST /api/webhooks/stripe', eventType: event.type });
    // Still return 200 — returning non-2xx causes Stripe to retry,
    // which could result in duplicate processing.
    console.error('[StripeWebhook] Error processing event:', err);
  }

  return new NextResponse('OK', { status: 200 });
}