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

      // Mark the reward code as redeemed.
      rewardCode.redeemed = true;
      rewardCode.redemptionDate = new Date();
      await rewardCode.save();
      console.log(`✅ Reward code ${code} marked as redeemed`);

      // Create a CommissionRecord if we have order context and a clientId.
      // orderContext is optional so existing callers without it don't break.
      if (orderContext && rewardCode.clientId) {
        const chargeAfter = new Date(orderContext.orderCreatedAt.getTime() + DAYS_30_MS);
        const commissionAmount = orderContext.orderTotal * COMMISSION_RATE;

        try {
          await CommissionRecord.create({
            shopifyOrderId: orderContext.shopifyOrderId,
            shopifyOrderGid: orderContext.shopifyOrderGid,
            shopDomain: orderContext.shopDomain,
            discountCode: code,
            clientId: rewardCode.clientId,
            orderTotal: orderContext.orderTotal,
            refundedAmount: 0,
            commissionRate: COMMISSION_RATE,
            commissionAmount,
            orderCreatedAt: orderContext.orderCreatedAt,
            chargeAfter,
            nextCheckAt: chargeAfter, // First check is at day 30
            status: 'pending',
          });
          console.log(
            `💰 CommissionRecord created for order ${orderContext.shopifyOrderId} — ` +
            `$${commissionAmount.toFixed(2)} due after ${chargeAfter.toISOString()}`
          );
        } catch (commissionErr: any) {
          // Unique index violation — already created for this order+code. Log and continue.
          if (commissionErr?.code === 11000) {
            console.warn(`⚠️ CommissionRecord already exists for order ${orderContext.shopifyOrderId} code ${code}`);
          } else {
            // Don't throw — reward redemption already succeeded. Log the billing failure
            // separately so it can be investigated without re-processing the reward.
            console.error(`🔥 Failed to create CommissionRecord for ${code}:`, commissionErr);
          }
        }
      } else if (orderContext && !rewardCode.clientId) {
        console.warn(`⚠️ No clientId on RewardCode ${code} — CommissionRecord not created`);
      }
    } catch (err) {
      console.error(`🔥 Error processing reward code ${code}:`, err);
    }
  }
}