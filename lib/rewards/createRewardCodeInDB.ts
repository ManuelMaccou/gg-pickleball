import { ClientSession } from 'mongoose';
import RewardCode from '@/app/models/RewardCode';
import { IRewardCode } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger'; // Make sure this import path is correct

// The payload can be a partial IRewardCode, which is flexible
type CreateRewardCodePayload = Partial<IRewardCode>;

type RequiredDbOptions = { session: ClientSession };

/**
 * A reusable function to validate and create a RewardCode document in the database.
 * This is the single source of truth for reward code creation.
 * It can be called from an API route (without a session) or a server-side
 * function (with a session) to ensure transactional integrity.
 */
export async function createRewardCodeInDB(
  payload: CreateRewardCodePayload,
  options: RequiredDbOptions
): Promise<IRewardCode> {
  const { session } = options;

  // 1. Centralized Validation (This is the logic moved from your API route)
  if (!payload.code || !payload.clientId || !payload.achievementId || !payload.reward) {
    const errorMessage = "Missing required fields for RewardCode creation.";
    logError(new Error(errorMessage), {
      task: 'createRewardCodeInDB validation',
      payload: {
        ...payload,
        // Avoid logging potentially large reward objects to Sentry
        reward: payload.reward ? `Exists (ID: ${payload.reward._id})` : 'Missing', 
      }
    });
    // Throwing an error here will be caught by the calling function's try/catch block
    throw new Error(errorMessage);
  }

  // 2. Database Creation Logic
  // Using RewardCode.create is a concise way to create and save a new document.
  // It accepts an array of documents and an options object (where we pass the session).
  // We wrap the single payload in an array to use this specific function signature.
  const [createdDoc] = await RewardCode.create([payload], { session });

  if (!createdDoc) {
    throw new Error('Database failed to create the reward code document.');
  }
  
  return createdDoc;
}