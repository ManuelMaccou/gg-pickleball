// app/api/cron/process-commissions/route.ts

// curl -X POST https://gg-pickleball-production-9f94.up.railway.app/api/shopify/cron/process-commissions -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"
// curl -X POST http://localhost:3000/api/shopify/cron/process-commissions -H "x-cron-secret: 3b73d1c4c4aa112e63b26d96af923ef7"

// Secured POST endpoint that processes pending and held CommissionRecords.
// On day 30, fires a Shopify App Events API billing event per order.
// Shopify charges the merchant 5% of the value sent.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import { checkOrderCommissionRisk } from '@/lib/shopify/checkOrderCommissionRisk';
import { sendAppEvent } from '@/lib/shopify/sendAppEvent';
import { logError } from '@/lib/sentry/logger';
import { ICommissionRecord } from '@/app/types/databaseTypes';
 
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
 
      // Day-60 cutoff — stop auto-processing, flag for manual review
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
          $set: {
            status: 'held',
            holdReason: decision.holdReason,
            lastCheckedAt: now,
            nextCheckAt,
          },
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
 
  // ── Fire one App Events API call per ready-to-charge order ───────────────
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
        console.log(
          `[CommissionCron] ✅ Charged order ${item.record.shopifyOrderId} — ` +
          `event key: ${eventResult.shopifyEventKey}, ` +
          `base: $${item.commissionBase.toFixed(2)}, ` +
          `commission: $${item.commissionAmount.toFixed(2)}`
        );
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
        console.error(
          `[CommissionCron] ❌ App Events failed for order ${item.record.shopifyOrderId}: ` +
          eventResult.error
        );
      }
    } catch (err: any) {
      logError(err, {
        context: `CommissionCron App Events call for record ${item.record._id}`,
      });
      await CommissionRecord.findByIdAndUpdate(item.record._id, {
        $set: {
          status: 'review',
          holdReason: null,
          lastCheckedAt: now,
          reviewNote: `App Events error: ${err?.message ?? 'Unknown'}`,
        },
      });
      results.review++;
      results.errors++;
    }
  }
 
  console.log('[CommissionCron] Run complete:', results);
  return NextResponse.json({ processed: dueRecords.length, results });
}