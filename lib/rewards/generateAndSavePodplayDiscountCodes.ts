import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';
import { createPodPlayDiscountCode } from '../podplay/createPodPlayDiscountCode';

export interface RewardCodeTask {
  userId: Types.ObjectId;
  rewardId: Types.ObjectId;
  clientId: Types.ObjectId;
}

export async function generateAndSavePodPlayDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<string, Types.ObjectId>> {
  const result = new Map<string, Types.ObjectId>();

  for (const task of tasks) {
    console.log('creating shopify code for task:', task)
    try {
      const code = await createPodPlayDiscountCode(task.rewardId);
      const rewardCodeDoc = await RewardCode.create({
        code,
        userId: task.userId,
        rewardId: task.rewardId,
        clientId: clientId,
        redeemed: false,
      });
      result.set(task.rewardId.toString(), rewardCodeDoc._id);
    } catch (err) {
      console.error(`Failed to create reward code for reward ${task.rewardId}:`, err);
    }
  }

  return result;
}

