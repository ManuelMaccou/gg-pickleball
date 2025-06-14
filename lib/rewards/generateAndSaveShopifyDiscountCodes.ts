import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';
import { createShopifyDiscountCode } from '../shopify/createShopifyDiscountCode';
import { IReward } from '@/app/types/databaseTypes';

export interface RewardCodeTask {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  clientId: Types.ObjectId;
}

// Map rewardId → rewardCodeId
export async function generateAndSaveShopifyDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<string, Types.ObjectId>> {
  const result = new Map<string, Types.ObjectId>();

  for (const task of tasks) {
    console.log('creating shopify code for task:', task)
    try {
      const code = await createShopifyDiscountCode(task.reward._id, clientId);
      const rewardCodeDoc = await RewardCode.create({
        code,
        userId: task.userId,
        achievementId: task.achievementId,
        reward: task.reward,
        clientId: clientId,
        redeemed: false,
      });
      result.set(task.reward._id.toString(), rewardCodeDoc._id);
    } catch (err) {
      console.error(`Failed to create reward code for reward ${task.reward._id}:`, err);
    }
  }

  return result;
}

