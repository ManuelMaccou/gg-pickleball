import connectToDatabase from '../mongodb';
import RewardCode from '@/app/models/RewardCode';

export async function redeemDiscountCode(discountCodes: string[]): Promise<void> {
  if (discountCodes.length === 0) {
    console.log('🚫 No discount codes provided for redemption.');
    return;
  }

  await connectToDatabase();

  for (const code of discountCodes) {
    try {
      const reward = await RewardCode.findOne({ code });

      if (!reward) {
        console.log(`❌ No reward found for code ${code}`);
        continue;
      }

      if (reward.redeemed) {
        console.log(`⚠️ Reward code ${code} already redeemed`);
        continue;
      }

      reward.redeemed = true;
      reward.redemptionDate = new Date();
      await reward.save();

      console.log(`✅ Reward code ${code} marked as redeemed`);
    } catch (err) {
      console.error(`🔥 Error processing reward code ${code}:`, err);
    }
  }
}
