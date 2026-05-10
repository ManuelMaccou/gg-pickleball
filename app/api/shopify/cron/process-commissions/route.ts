// app/api/shopify/cron/process-commissions/route.ts
//
// Secured POST endpoint that processes pending and held CommissionRecords.
// Call this daily via Railway cron or external scheduler.
//
// Railway cron example (railway.toml):
//   [cron]
//   schedule = "0 9 * * *"   # 9am UTC daily
//   command = "curl -X POST https://your-domain.com/api/shopify/cron/process-commissions \
//              -H 'x-cron-secret: YOUR_SECRET'"
//
// Set CRON_SECRET in your Railway environment variables.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import { checkOrderCommissionRisk } from '@/lib/shopify/checkOrderCommissionRisk';

const COMMISSION_RATE = 0.05;
const DAYS_5_MS = 5 * 24 * 60 * 60 * 1000;
const DAYS_60_MS = 60 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();

  // Find all records that are due for evaluation.
  // Both 'pending' (first check) and 'held' (re-check) use nextCheckAt.
  const dueRecords = await CommissionRecord.find({
    status: { $in: ['pending', 'held'] },
    nextCheckAt: { $lte: now },
  }).lean();

  console.log(`[CommissionCron] Found ${dueRecords.length} record(s) to process`);

  const results = {
    charged: 0,
    held: 0,
    waived: 0,
    review: 0,
    errors: 0,
  };

  for (const record of dueRecords) {
    try {
      // Check if this record has been held past the 60-day review threshold.
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
        console.warn(
          `[CommissionCron] ⚠️ Record ${record._id} flagged for review ` +
          `(order ${record.shopifyOrderId}, day ${Math.floor(daysSinceOrder)})`
        );
        results.review++;
        continue;
      }

      // Query Shopify for current order state.
      const decision = await checkOrderCommissionRisk(
        record.shopifyOrderGid,
        record.clientId.toString()
      );

      if (decision.action === 'hold') {
        const nextCheckAt = new Date(now.getTime() + DAYS_5_MS);
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'held',
            lastCheckedAt: now,
            nextCheckAt,
          },
        });
        console.log(
          `[CommissionCron] ⏳ Held record ${record._id} — next check ${nextCheckAt.toISOString()}`
        );
        results.held++;
        continue;
      }

      if (decision.action === 'waive') {
        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'waived',
            lastCheckedAt: now,
            refundedAmount: record.orderTotal, // Full order effectively lost
            commissionAmount: 0,
            reviewNote: decision.reason,
          },
        });
        console.log(
          `[CommissionCron] ❌ Waived record ${record._id} — ${decision.reason}`
        );
        results.waived++;
        continue;
      }

      if (decision.action === 'charge') {
        const commissionAmount = decision.commissionBase * COMMISSION_RATE;
        const refundedAmount = record.orderTotal - decision.commissionBase;

        // TODO: Integrate Stripe here.
        // const paymentIntent = await stripe.paymentIntents.create({ ... });
        // For now, mark as charged without Stripe until billing is wired up.
        // This lets you validate the decision logic independently.

        await CommissionRecord.findByIdAndUpdate(record._id, {
          $set: {
            status: 'charged',
            lastCheckedAt: now,
            refundedAmount,
            commissionAmount,
            // stripePaymentIntentId: paymentIntent.id, // Uncomment when Stripe is ready
          },
        });
        console.log(
          `[CommissionCron] ✅ Charged record ${record._id} — ` +
          `$${commissionAmount.toFixed(2)} on base $${decision.commissionBase.toFixed(2)}`
        );
        results.charged++;
        continue;
      }
    } catch (err) {
      console.error(`[CommissionCron] 🔥 Error processing record ${record._id}:`, err);
      results.errors++;
    }
  }

  console.log('[CommissionCron] Run complete:', results);
  return NextResponse.json({ processed: dueRecords.length, results });
}