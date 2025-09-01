// /lib/rewards/generateAndSaveCustomDiscountCodes.ts

import { Types } from 'mongoose';
import { generateUniqueRewardCode } from './generateUniqueRewardCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';

/**
 * Generates and saves "custom" reward codes locally without integrating with an external POS.
 * This is used for rewards that are redeemed manually.
 * @param tasks - An array of reward generation tasks.
 * @param clientId - The ID of the client.
 * @returns A map of the original reward ID to the newly created RewardCode document ID.
 */
export async function generateAndSaveCustomDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<string, Types.ObjectId>> {
  const result = new Map<string, Types.ObjectId>();
  const codes = new Set<string>(); // Used to ensure uniqueness within this batch

  if (!process.env.NEXT_PUBLIC_BASE_URL || !process.env.INTERNAL_API_KEY) {
    throw new Error('Missing required environment variables for reward code creation');
  }

  for (const task of tasks) {
    try {
      // 1. Generate a unique code string
      const code = await generateUniqueRewardCode(clientId, codes);

      // 2. Prepare the payload for our internal API
      const payload: Partial<IRewardCode> = {
        code,
        userId: task.userId,
        clientId: clientId,
        achievementId: task.achievementId,
        reward: task.reward,
        addedToPos: false, // Explicitly false as it's not added to a POS
      };

      // 3. Call our internal API to create the RewardCode document
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/reward-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.INTERNAL_API_KEY ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reward code');
      }

      // 4. Map the original reward ID to the new code's ID for the return value
      const data: IRewardCode = await response.json();
      result.set(task.reward._id.toString(), data._id);

    } catch (err) {
      console.error(`Error generating local custom reward code for ${task.reward.name ?? 'unknown'}:`, err);
    }
  }

  return result;
}