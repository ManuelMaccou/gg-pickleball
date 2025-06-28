import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';
import { IReward } from '@/app/types/databaseTypes';

export interface RewardCodeTask {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  reward: IReward;
  clientId: Types.ObjectId;
}

// Map rewardId → rewardCodeId
export async function assignPlayByPointDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId
): Promise<Map<string, Types.ObjectId>> {
  const result = new Map<string, Types.ObjectId>();

  console.log('assigning PBP reward code')

  for (const task of tasks) {
    console.log('Assigning reward code for task:', task);
    try {
      const rewardCode = await RewardCode.findOneAndUpdate(
        {
          clientId: clientId,
          'reward.name': task.reward.name,
          addedToPos: true,
          $or: [
            { userId: { $exists: false } },
            { userId: null },
          ]
        },
        {
          $set: {
            userId: task.userId,
            createdAt: new Date(), // Intentionally override the original creation timestamp
          },
        },
        {
          new: true,
          timestamps: false,
        }
      ).exec();

      if (!rewardCode) {
        throw new Error(
          `No available reward code found for reward name "${task.reward.name}" and client ${clientId.toString()}`
        );
      }

      result.set(task.reward._id.toString(), rewardCode._id);
    } catch (err) {
      console.error(`Failed to assign reward code for reward ${task.reward._id}:`, err);
    }
  }

  return result;
}
