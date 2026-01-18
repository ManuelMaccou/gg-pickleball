import RewardCode from '@/app/models/RewardCode';
import { Types, ClientSession } from 'mongoose';
import { createShopifyDiscountCode } from '../shopify/createShopifyDiscountCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';

// Define the GeneratorOptions type here or import it from a shared types file
interface GeneratorOptions {
  session: ClientSession;
}

type RewardCodeCreationPayload = Omit<IRewardCode, '_id' | 'createdAt' | 'updatedAt' | 'redemptionDate'>;

// Map rewardId → rewardCodeId
export async function generateAndSaveShopifyDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<Map<string, Types.ObjectId>> {
  const { session } = options; // <-- Extract session
  const result = new Map<string, Types.ObjectId>();

  const rewardCodeDocsToCreate: RewardCodeCreationPayload[] = [];
  const tasksToProcess: RewardCodeTask[] = [];

// Phase 1: Create all Shopify codes first
  for (const task of tasks) {
    try {
      const code = await createShopifyDiscountCode(task.reward._id, clientId, options);
      if (code) {
        // Inside this block, TypeScript knows `code` is a `string`.
        rewardCodeDocsToCreate.push({
          code, // No more error here
          userId: task.userId,
          achievementId: task.achievementId,
          reward: task.reward,
          clientId: clientId,
          redeemed: false,
          addedToPos: true,
          isGlobalReward: task.isGlobalReward ?? false,
          dataSourceId: task.dataSourceId ? new Types.ObjectId(task.dataSourceId) : undefined,
        });
        tasksToProcess.push(task); // Keep track of the original task
      } else {
        // Optional: Log that a code was not generated for this task
        console.warn(`Failed to generate a Shopify code for reward ${task.reward._id.toString()}, skipping.`);
      }
    } catch (err) {
      console.error(`Failed to create Shopify discount for reward ${task.reward._id}:`, err);
    }
  }

  // Phase 2: Create all database documents in a single, atomic operation
  if (rewardCodeDocsToCreate.length > 0) {
    try {
      // Use insertMany for efficiency and pass the session
      const createdDocs = await RewardCode.insertMany(rewardCodeDocsToCreate, { session });
      
      // Map the results back to the original reward IDs
      for (let i = 0; i < createdDocs.length; i++) {
        const originalTask = tasksToProcess[i];
        const newDoc = createdDocs[i];
        result.set(originalTask.reward._id.toString(), newDoc._id);
      }
    } catch (err) {
      console.error('Failed to save Shopify reward codes to the database:', err);
    }
  }

  return result;
}