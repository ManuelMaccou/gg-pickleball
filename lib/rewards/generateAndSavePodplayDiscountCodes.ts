import RewardCode from '@/app/models/RewardCode';
import { Types, ClientSession } from 'mongoose';
import { createPodPlayDiscountCode } from '../podplay/createPodPlayDiscountCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';

interface GeneratorOptions {
  session: ClientSession;
}

type RewardCodeCreationPayload = Omit<IRewardCode, '_id' | 'createdAt' | 'updatedAt' | 'redemptionDate'>;

export async function generateAndSavePodPlayDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<Map<string, Types.ObjectId>> {
  const { session } = options; // <-- Extract session
  const result = new Map<string, Types.ObjectId>();

  const rewardCodeDocsToCreate: RewardCodeCreationPayload[] = [];
  const tasksToProcess: RewardCodeTask[] = [];

  // Phase 1: Create all PodPlay codes
  for (const task of tasks) {
    try {
      const code = await createPodPlayDiscountCode(task.reward._id);
      rewardCodeDocsToCreate.push({
        code,
        userId: task.userId,
        achievementId: task.achievementId,
        reward: task.reward,
        clientId: clientId,
        redeemed: false,
        addedToPos: true,
        isGlobalReward: task.isGlobalReward ?? false,
        dataSourceId: task.dataSourceId,
      });
      tasksToProcess.push(task);
    } catch (err) {
      console.error(`Failed to create PodPlay reward code for reward ${task.reward._id}:`, err);
    }
  }

  // Phase 2: Create all database documents
  if (rewardCodeDocsToCreate.length > 0) {
    try {
      const createdDocs = await RewardCode.insertMany(rewardCodeDocsToCreate, { session });
      
      for (let i = 0; i < createdDocs.length; i++) {
        const originalTask = tasksToProcess[i];
        const newDoc = createdDocs[i];
        result.set(originalTask.reward._id.toString(), newDoc._id);
      }
    } catch (err) {
      console.error('Failed to save PodPlay reward codes to the database:', err);
    }
  }

  return result;
}

