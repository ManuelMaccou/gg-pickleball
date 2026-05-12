// app/api/cron/process-commissions/route.ts

// curl -X POST gg-pickleball-production-9f94.up.railway.app/api/cron/process-commissions \ -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"

// Secured POST endpoint that processes pending and held CommissionRecords.
// On day 30, consolidates all due commissions per client into a single
// Stripe invoice with one line item per order.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { CommissionRecord} from '@/app/models/CommissionRecord';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import { checkOrderCommissionRisk } from '@/lib/shopify/checkOrderCommissionRisk';
import { logError } from '@/lib/sentry/logger';
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

  const dueRecords = await CommissionRecord.find({
    status: { $in: ['pending', 'held'] },
    nextCheckAt: { $lte: now },
  }).lean();

  console.log(`[CommissionCron] Found ${dueRecords.length} record(s) to process`);

  const results = { charged: 0, held: 0, waived: 0, review: 0, errors: 0 };

  // ── Evaluate each record ──────────────────────────────────────────────────
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
          $set: { status: 'held', lastCheckedAt: now, nextCheckAt },
        });
        results.held++;
        continue;
      }

      if (decision.action === 'waive') {
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'waived',
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
        const commissionAmount =
          Math.round(decision.commissionBase * COMMISSION_RATE * 100) / 100;
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

  // ── Batch charge by client — one invoice per client ───────────────────────
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
        console.warn(`[CommissionCron] ⚠️ No payment method for client ${clientId}`);
        for (const item of items) {
          await CommissionRecord.findByIdAndUpdate(item.record._id, {
            $set: {
              status: 'review',
              lastCheckedAt: now,
              reviewNote: 'No payment method on file — manual collection required',
            },
          });
          results.review++;
        }
        continue;
      }

      // Create invoice.
      const invoice = await stripe.invoices.create({
        customer: stripeCustomer.stripeCustomerId,
        default_payment_method: stripeCustomer.stripePaymentMethodId,
        auto_advance: true,
        collection_method: 'charge_automatically',
        metadata: { clientId, orderCount: String(items.length) },
      });

      // One line item per order.
      for (const item of items) {
        await stripe.invoiceItems.create({
          customer: stripeCustomer.stripeCustomerId,
          invoice: invoice.id,
          amount: Math.round(item.commissionAmount * 100), // cents
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

      // Finalize then charge.
      await stripe.invoices.finalizeInvoice(invoice.id);
      const paidInvoice = await stripe.invoices.pay(invoice.id) as any;

      if (paidInvoice.status === 'paid') {
        for (const item of items) {
          await CommissionRecord.findByIdAndUpdate(item.record._id, {
            $set: {
              status: 'charged',
              lastCheckedAt: now,
              refundedAmount: item.refundedAmount,
              commissionAmount: item.commissionAmount,
              stripePaymentIntentId: paidInvoice.payment_intent ?? undefined,
              stripeInvoiceId: invoice.id,
            },
          });
          results.charged++;
        }
        console.log(
          `[CommissionCron] ✅ Charged client ${clientId} — ` +
          `invoice ${invoice.id}, ${items.length} order(s)`
        );
      } else {
        for (const item of items) {
          await CommissionRecord.findByIdAndUpdate(item.record._id, {
            $set: {
              status: 'review',
              lastCheckedAt: now,
              reviewNote: `Invoice ${invoice.id} payment failed — status: ${paidInvoice.status}`,
            },
          });
          results.review++;
        }
      }
    } catch (err: any) {
      logError(err, { context: `CommissionCron Stripe charge client ${clientId}` });
      for (const item of items) {
        await CommissionRecord.findByIdAndUpdate(item.record._id, {
          $set: {
            status: 'review',
            lastCheckedAt: now,
            reviewNote: `Stripe error: ${err?.message ?? 'Unknown'}`,
          },
        });
        results.review++;
      }
      results.errors++;
    }
  }

  console.log('[CommissionCron] Run complete:', results);
  return NextResponse.json({ processed: dueRecords.length, results });
}