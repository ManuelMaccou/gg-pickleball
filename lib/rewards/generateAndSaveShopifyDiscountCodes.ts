import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';
import { createShopifyDiscountCode } from '../shopify/createShopifyDiscountCode';

export interface RewardCodeTask {
  userId: Types.ObjectId;
  rewardId: Types.ObjectId;
  clientId: Types.ObjectId;
}

// Map rewardId → rewardCodeId
export async function generateAndSaveShopifyDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<Types.ObjectId, Types.ObjectId>> {
  const result = new Map<Types.ObjectId, Types.ObjectId>();

  for (const task of tasks) {
    console.log('creating shopify code for task:', task)
    try {
      const code = await createShopifyDiscountCode(task.rewardId, clientId);
      const rewardCodeDoc = await RewardCode.create({
        code,
        userId: task.userId,
        rewardId: task.rewardId,
        clientId: clientId,
        redeemed: false,
      });
      result.set(task.rewardId, rewardCodeDoc._id);
    } catch (err) {
      console.error(`Failed to create reward code for reward ${task.rewardId}:`, err);
    }
  }

  return result;
}

