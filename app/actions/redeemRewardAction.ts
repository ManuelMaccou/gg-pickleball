// Create or update the file: /app/actions/redeemRewardAction.ts
'use server'

import { revalidatePath } from 'next/cache';
import connectToDatabase from '@/lib/mongodb';
import RewardCode from '@/app/models/RewardCode';

interface RedeemResult {
  success: boolean;
  message: string;
  redemptionDate?: string; 
}

/**
 * Redeems a reward by updating its document in the RewardCode collection.
 * This is the single source of truth for this operation.
 * @param rewardCode The code string to redeem.
 * @returns A promise resolving to a success or failure object.
 */
export async function redeemRewardAction(rewardCode: string): Promise<RedeemResult> {
  if (!rewardCode) {
    return { success: false, message: 'No reward code provided.' };
  }

  try {
    await connectToDatabase();

    const redemptionDate = new Date();
    
    const updateResult = await RewardCode.updateOne(
      { code: rewardCode, redeemed: { $ne: true } },
      { $set: { redeemed: true, redemptionDate: new Date() } }
    );

    // Check if a document was actually found and modified
    if (updateResult.matchedCount === 0) {
      // This can happen if the code is invalid or was already redeemed.
      console.warn(`Attempted to redeem an invalid or already redeemed code: ${rewardCode}`);
      return { success: false, message: 'Code is invalid or has already been redeemed.' };
    }

    // The magic: Invalidate the cache for the admin page.
    // This tells Next.js to re-fetch the server-side data, which will
    // re-populate the user list with the fresh `redeemed: true` status.
    revalidatePath('/admin');

    return { 
      success: true, 
      message: 'Reward redeemed successfully!',
      redemptionDate: redemptionDate.toISOString()
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error(`Error redeeming code ${rewardCode}:`, errorMessage);
    return { success: false, message: errorMessage };
  }
}