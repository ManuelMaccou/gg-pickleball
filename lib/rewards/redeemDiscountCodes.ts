// lib/rewards/redeemDiscountCodes.ts

import connectToDatabase from '../mongodb';
import RewardCode from '@/app/models/RewardCode';
import { CommissionRecord } from '@/app/models/CommissionRecord';

const COMMISSION_RATE = 0.05;
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

interface OrderContext {
  shopifyOrderId: string;
  shopifyOrderGid: string;
  shopDomain: string;
  orderTotal: number;
  orderCreatedAt: Date;
}

export async function redeemDiscountCode(
  discountCodes: string[],
  orderContext?: OrderContext
): Promise<void> {
  if (discountCodes.length === 0) {
    console.log('🚫 No discount codes provided for redemption.');
    return;
  }

  await connectToDatabase();

  // Collected across the whole loop so exactly ONE CommissionRecord gets
  // created for the order afterward, instead of one per code. Two GG
  // codes on the same order previously created two records, each
  // independently billing the FULL order total — doubling the commission
  // charged for one real-world order.
  const redeemedCodesForThisOrder: string[] = [];
  let orderClientId: any = null;

  for (const code of discountCodes) {
    try {
      const rewardCode = await RewardCode.findOne({ code });

      if (!rewardCode) {
        console.log(`❌ No reward found for code ${code}`);
        continue;
      }

      if (rewardCode.redeemed) {
        console.log(`⚠️ Reward code ${code} already redeemed`);
        continue;
      }

      // Still per-code, independent of the commission logic below — each
      // player's code needs its own redeemed status regardless of how
      // billing gets aggregated.
      rewardCode.redeemed = true;
      rewardCode.redemptionDate = new Date();
      await rewardCode.save();
      console.log(`✅ Reward code ${code} marked as redeemed`);

      if (rewardCode.clientId) {
        redeemedCodesForThisOrder.push(code);
        // Every GG code on one order comes from the same store's
        // checkout, so they always share a clientId — just take the first.
        if (!orderClientId) orderClientId = rewardCode.clientId;
      } else {
        console.warn(`⚠️ No clientId on RewardCode ${code} — excluded from commission`);
      }
    } catch (err) {
      console.error(`🔥 Error processing reward code ${code}:`, err);
    }
  }

  // ── One CommissionRecord per real-world order, not per code ────────────
  if (orderContext && orderClientId && redeemedCodesForThisOrder.length > 0) {
    const chargeAfter = new Date(orderContext.orderCreatedAt.getTime() + DAYS_30_MS);
    const commissionAmount = Math.round(orderContext.orderTotal * COMMISSION_RATE * 100) / 100;

    try {
      // Upsert keyed on shopifyOrderId alone (NOT shopifyOrderId +
      // discountCode — that pairing is exactly what let multiple codes on
      // one order create multiple records). $addToSet means a code
      // arriving on a later delivery for an order whose record already
      // exists (e.g. the order was edited to add a second code after the
      // first webhook fired) still gets appended for display, without
      // ever re-billing — commissionAmount is only ever set once, on
      // first creation, via $setOnInsert.
      await CommissionRecord.findOneAndUpdate(
        { shopifyOrderId: orderContext.shopifyOrderId },
        {
          $setOnInsert: {
            shopifyOrderGid: orderContext.shopifyOrderGid,
            shopDomain: orderContext.shopDomain,
            clientId: orderClientId,
            orderTotal: orderContext.orderTotal,
            refundedAmount: 0,
            commissionRate: COMMISSION_RATE,
            commissionAmount,
            orderCreatedAt: orderContext.orderCreatedAt,
            chargeAfter,
            nextCheckAt: chargeAfter, // First check is at day 30
            status: 'pending',
          },
          $addToSet: { discountCodes: { $each: redeemedCodesForThisOrder } },
        },
        { upsert: true, new: true }
      );

      console.log(
        `💰 CommissionRecord ready for order ${orderContext.shopifyOrderId} — ` +
        `codes: ${redeemedCodesForThisOrder.join(', ')}, ` +
        `$${commissionAmount.toFixed(2)} due after ${chargeAfter.toISOString()}`
      );
    } catch (commissionErr: any) {
      // A genuine race between two near-simultaneous webhook deliveries
      // for the same order can still surface as 11000 here occasionally.
      // Not fatal — reward redemption above already succeeded either way.
      if (commissionErr?.code === 11000) {
        console.warn(`⚠️ CommissionRecord race for order ${orderContext.shopifyOrderId} — safe to ignore`);
      } else {
        console.error(`🔥 Failed to upsert CommissionRecord for order ${orderContext.shopifyOrderId}:`, commissionErr);
      }
    }
  } else if (orderContext && redeemedCodesForThisOrder.length === 0) {
    console.log(`ℹ️ No newly-redeemed GG codes for order ${orderContext.shopifyOrderId} — no commission action taken.`);
  }
}