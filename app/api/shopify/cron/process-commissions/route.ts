// app/api/cron/process-commissions/route.ts

// curl -X POST https://gg-pickleball-production-9f94.up.railway.app/api/shopify/cron/process-commissions -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"
// curl -X POST http://localhost:3000/api/shopify/cron/process-commissions -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"

// Secured POST endpoint that processes pending and held CommissionRecords.
// On day 30+, evaluates each record for risk and charges accordingly.
//
// Custom mode (SHOPIFY_APP_MODE=custom):
//   Batches all due commissions per client into a single Stripe invoice.
//   After invoices.pay(), sets status to 'processing' and waits for the
//   Stripe webhook (invoice.paid / invoice.payment_failed) to confirm.
//   'processing' records are excluded from the cron query — the webhook
//   handler is responsible for transitioning them to 'charged' or 'review'.
//
// Public mode (SHOPIFY_APP_MODE=public):
//   Fires one Shopify App Events API call per order (original behaviour).

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import { checkOrderCommissionRisk } from '@/lib/shopify/checkOrderCommissionRisk';
import { sendAppEvent } from '@/lib/shopify/sendAppEvent';
import { logError } from '@/lib/sentry/logger';
import { isCustomAppMode } from '@/lib/shopify/appMode';
import { ICommissionRecord } from '@/app/types/databaseTypes';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const COMMISSION_RATE = 0.05;
const DAYS_5_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const customMode = isCustomAppMode();

  console.log(`[CommissionCron] Running in ${customMode ? 'custom (Stripe)' : 'public (App Events)'} mode`);

  // 'processing' is excluded — those are waiting for Stripe webhook confirmation.
  // 'held' and 'pending' are the only statuses eligible for re-evaluation.
  const dueRecords = await CommissionRecord.find({
    status: { $in: ['pending', 'held'] },
    nextCheckAt: { $lte: now },
  }).lean();

  console.log(`[CommissionCron] Found ${dueRecords.length} record(s) to process`);

  const results = { charged: 0, held: 0, waived: 0, review: 0, processing: 0, errors: 0 };

  const readyToCharge: Array<{
    record: ICommissionRecord;
    commissionBase: number;
    commissionAmount: number;
    refundedAmount: number;
  }> = [];

  for (const record of dueRecords) {
    try {
      const daysSinceOrder =
        (now.getTime() - record.orderCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceOrder >= 60 && record.status === 'held') {
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'review',
            holdReason: null,
            lastCheckedAt: now,
            reviewNote: `Unresolved at day ${Math.floor(daysSinceOrder)} — manual review required`,
          },
        });
        console.warn(`[CommissionCron] ⚠️ Review: ${record._id}`);
        results.review++;
        continue;
      }

      const decision = await checkOrderCommissionRisk(
        record.shopifyOrderGid,
        record.clientId.toString()
      );

      if (decision.action === 'hold') {
        const nextCheckAt = new Date(now.getTime() + DAYS_5_MS);
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: { status: 'held', holdReason: decision.holdReason, lastCheckedAt: now, nextCheckAt },
        });
        results.held++;
        continue;
      }

      if (decision.action === 'waive') {
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'waived',
            holdReason: null,
            lastCheckedAt: now,
            refundedAmount: record.orderTotal,
            commissionAmount: 0,
            reviewNote: decision.reason,
          },
        });
        results.waived++;
        continue;
      }

      if (decision.action === 'charge') {
        const commissionAmount = Math.round(decision.commissionBase * COMMISSION_RATE * 100) / 100;
        const refundedAmount = record.orderTotal - decision.commissionBase;
        readyToCharge.push({
          record: record as unknown as ICommissionRecord,
          commissionBase: decision.commissionBase,
          commissionAmount,
          refundedAmount,
        });
      }
    } catch (err) {
      logError(err, { context: `CommissionCron record ${record._id}` });
      results.errors++;
    }
  }

  if (customMode) {
    await chargeViaStripe(readyToCharge, now, results);
  } else {
    await chargeViaAppEvents(readyToCharge, now, results);
  }

  console.log('[CommissionCron] Run complete:', results);
  return NextResponse.json({ processed: dueRecords.length, results });
}

// ── Custom mode: batch per client, one Stripe invoice ────────────────────────

async function chargeViaStripe(
  readyToCharge: Array<{
    record: ICommissionRecord;
    commissionBase: number;
    commissionAmount: number;
    refundedAmount: number;
  }>,
  now: Date,
  results: { charged: number; held: number; waived: number; review: number; processing: number; errors: number }
) {
  const byClient = new Map<string, typeof readyToCharge>();
  for (const item of readyToCharge) {
    const key = item.record.clientId.toString();
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key)!.push(item);
  }

  for (const [clientId, items] of byClient.entries()) {
    try {
      const stripeCustomer = await StripeCustomer.findOne({ clientId }).lean();

      if (!stripeCustomer?.stripePaymentMethodId) {
        console.warn(`[CommissionCron] ⚠️ No Stripe payment method for client ${clientId}`);
        for (const item of items) {
          await CommissionRecord.findByIdAndUpdate(item.record._id, {
            $set: {
              status: 'review',
              holdReason: null,
              lastCheckedAt: now,
              reviewNote: 'No payment method on file — manual collection required',
            },
          });
          results.review++;
        }
        continue;
      }

      const invoice = await stripe.invoices.create({
        customer: stripeCustomer.stripeCustomerId,
        default_payment_method: stripeCustomer.stripePaymentMethodId,
        auto_advance: true,
        collection_method: 'charge_automatically',
        metadata: { clientId, orderCount: String(items.length) },
      });

      for (const item of items) {
        await stripe.invoiceItems.create({
          customer: stripeCustomer.stripeCustomerId,
          invoice: invoice.id,
          amount: Math.round(item.commissionAmount * 100),
          currency: 'usd',
          description:
            `5% commission — order ${item.record.shopifyOrderId} ` +
            `(${item.record.discountCode}), sale: $${item.commissionBase.toFixed(2)}`,
          metadata: {
            commissionRecordId: item.record._id.toString(),
            shopifyOrderId: item.record.shopifyOrderId,
            discountCode: item.record.discountCode,
          },
        });
      }

      await stripe.invoices.finalizeInvoice(invoice.id);

      // Trigger payment — for ACH and some other methods this is async.
      // We don't wait for confirmation here. Instead we set status to
      // 'processing' and let the Stripe webhook (invoice.paid /
      // invoice.payment_failed) transition the record to 'charged' or 'review'.
      await stripe.invoices.pay(invoice.id);

      for (const item of items) {
        await CommissionRecord.findByIdAndUpdate(item.record._id, {
          $set: {
            status: 'processing',
            holdReason: null,
            lastCheckedAt: now,
            refundedAmount: item.refundedAmount,
            commissionAmount: item.commissionAmount,
            stripeInvoiceId: invoice.id,
            reviewNote: `Invoice ${invoice.id} sent to Stripe — awaiting payment confirmation via webhook`,
          },
        });
        results.processing++;
      }

      console.log(
        `[CommissionCron] ⏳ Invoice ${invoice.id} sent for client ${clientId} — ` +
        `${items.length} order(s) now in 'processing'. Webhook will confirm.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown';
      logError(err, { context: `CommissionCron Stripe charge client ${clientId}` });
      for (const item of items) {
        await CommissionRecord.findByIdAndUpdate(item.record._id, {
          $set: {
            status: 'review',
            holdReason: null,
            lastCheckedAt: now,
            reviewNote: `Stripe error creating invoice: ${message}`,
          },
        });
        results.review++;
      }
      results.errors++;
    }
  }
}

// ── Public mode: one App Events call per order ────────────────────────────────

async function chargeViaAppEvents(
  readyToCharge: Array<{
    record: ICommissionRecord;
    commissionBase: number;
    commissionAmount: number;
    refundedAmount: number;
  }>,
  now: Date,
  results: { charged: number; held: number; waived: number; review: number; processing: number; errors: number }
) {
  for (const item of readyToCharge) {
    try {
      const eventResult = await sendAppEvent({
        clientId: item.record.clientId.toString(),
        shopifyOrderId: item.record.shopifyOrderId,
        commissionRecordId: item.record._id.toString(),
        commissionBase: item.commissionBase,
        orderCreatedAt: item.record.orderCreatedAt,
      });

      if (eventResult.success) {
        await CommissionRecord.findByIdAndUpdate(item.record._id, {
          $set: {
            status: 'charged',
            holdReason: null,
            lastCheckedAt: now,
            refundedAmount: item.refundedAmount,
            commissionAmount: item.commissionAmount,
            shopifyEventKey: eventResult.shopifyEventKey,
          },
        });
        results.charged++;
        console.log(`[CommissionCron] ✅ App Events charged order ${item.record.shopifyOrderId}`);
      } else {
        await CommissionRecord.findByIdAndUpdate(item.record._id, {
          $set: {
            status: 'review',
            holdReason: null,
            lastCheckedAt: now,
            reviewNote: `Shopify App Events error: ${eventResult.error ?? 'Unknown'}`,
          },
        });
        results.review++;
        console.error(`[CommissionCron] ❌ App Events failed for order ${item.record.shopifyOrderId}: ${eventResult.error}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown';
      logError(err, { context: `CommissionCron App Events call for record ${item.record._id}` });
      await CommissionRecord.findByIdAndUpdate(item.record._id, {
        $set: {
          status: 'review',
          holdReason: null,
          lastCheckedAt: now,
          reviewNote: `App Events error: ${message}`,
        },
      });
      results.review++;
      results.errors++;
    }
  }
}