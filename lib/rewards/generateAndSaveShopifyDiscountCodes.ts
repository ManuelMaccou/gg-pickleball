// lib/rewards/generateAndSaveShopifyDiscountCodes.ts

import RewardCode from '@/app/models/RewardCode';
import { Types, ClientSession } from 'mongoose';
import { createShopifyDiscountCode } from '../shopify/createShopifyDiscountCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';

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
  const { session } = options;
  const result = new Map<string, Types.ObjectId>();

  const rewardCodeDocsToCreate: RewardCodeCreationPayload[] = [];
  const tasksToProcess: RewardCodeTask[] = [];

  // Phase 1: Create all Shopify codes first (outside the session)
  for (const task of tasks) {
    try {
      const code = await createShopifyDiscountCode(task.reward._id, clientId, options);
      if (code) {
        rewardCodeDocsToCreate.push({
          code,
          userId: task.userId,
          achievementId: task.achievementId,
          reward: task.reward,
          clientId: clientId,
          redeemed: false,
          addedToPos: true,
          isGlobalReward: task.isGlobalReward ?? false,
          dataSourceId: task.dataSourceId ? new Types.ObjectId(task.dataSourceId) : undefined,
        });
        tasksToProcess.push(task);
      } else {
        console.warn(
          `Failed to generate a Shopify code for reward ${task.reward._id.toString()}, skipping.`
        );
      }
    } catch (err: any) {
      // Auth errors mean the merchant's Shopify connection is broken.
      // We log clearly but DO NOT re-throw — the player's match stats and
      // achievements must still be saved even if a reward code fails.
      // The daily token refresh cron prevents this from happening in normal
      // operation. If it does occur, the merchant needs to reconnect Shopify.
      const isAuthError =
        err.message?.includes('401') ||
        err.message?.includes('Token refresh failed') ||
        err.message?.includes('merchant must reconnect');

      if (isAuthError) {
        console.error(
          `[RewardCode] ⚠️ AUTH FAILURE for client ${clientId} — Shopify token is invalid ` +
          `and could not be refreshed. Reward ${task.reward._id} skipped. ` +
          `Match processing continues. Merchant must reconnect Shopify.`
        );
      } else {
        console.error(
          `Failed to create Shopify discount for reward ${task.reward._id}:`,
          err
        );
      }
    }
  }

  // Phase 2: Save all reward code documents atomically within the session
  if (rewardCodeDocsToCreate.length > 0) {
    try {
      const createdDocs = await RewardCode.insertMany(rewardCodeDocsToCreate, { session });

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