import { Types, ClientSession } from 'mongoose';
import { generateUniqueRewardCode } from './generateUniqueRewardCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';
import { createRewardCodeInDB } from './createRewardCodeInDB'; // <-- Import new function

interface GeneratorOptions {
  session: ClientSession;
}

export async function generateAndSaveCustomDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<Map<string, Types.ObjectId>> {
  const { session } = options; // <-- Get session
  const result = new Map<string, Types.ObjectId>();
  const codes = new Set<string>();

  if (!process.env.NEXT_PUBLIC_BASE_URL || !process.env.INTERNAL_API_KEY) {
    throw new Error('Missing required environment variables for reward code creation');
  }

  for (const task of tasks) {
    try {
      const code = await generateUniqueRewardCode(clientId, codes, { session });

      const payload: Partial<IRewardCode> = {
        code,
        userId: task.userId,
        clientId: clientId,
        achievementId: task.achievementId,
        reward: task.reward,
        addedToPos: false,
        isGlobalReward: task.isGlobalReward ?? false,
        dataSourceId: task.dataSourceId,
      };

      // Replace the fetch call with a direct call to our new DB function
      const data = await createRewardCodeInDB(payload, { session });

      result.set(task.reward._id.toString(), data._id);

    } catch (err) {
      console.error(`Error generating local custom reward code for ${task.reward.name ?? 'unknown'}:`, err);
    }
  }

  return result;
}