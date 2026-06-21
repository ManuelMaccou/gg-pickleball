// lib/rewards/generateAndSaveShopifyDiscountCodes.ts

import RewardCode from '@/app/models/RewardCode';
import { Types, ClientSession } from 'mongoose';
import { createShopifyDiscountCode } from '../shopify/createShopifyDiscountCode';
import { RewardCodeTask } from '@/app/types/rewardTypes';
import { IRewardCode } from '@/app/types/databaseTypes';
import { logRewardEvent, LogContext } from './rewardProcessingLogger';

export interface GeneratorOptions {
  session: ClientSession;
  // Optional side-channel for surfacing non-throwing errors back to the caller.
  // Generators add string flags here (e.g. 'auth_error') when a known failure
  // occurs that should be communicated upstream without aborting the whole flow.
  errors?: Set<string>;
  // When present, structured log events are written to RewardProcessingLog.
  // Populated by the process route with the triggering player's userId and matchId.
  logContext?: LogContext;
}

type RewardCodeCreationPayload = Omit<IRewardCode, '_id' | 'createdAt' | 'updatedAt' | 'redemptionDate'>;

// Map rewardId → rewardCodeId
export async function generateAndSaveShopifyDiscountCodes(
  tasks: RewardCodeTask[],
  clientId: Types.ObjectId,
  options: GeneratorOptions
): Promise<Map<string, Types.ObjectId>> {
  const { session, errors, logContext } = options;
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
        const msg =
          `Failed to generate Shopify code for reward ${task.reward._id.toString()} — ` +
          `createShopifyDiscountCode returned null. Skipping.`;
        console.warn(`[RewardCode] ${msg}`);

        if (logContext) {
          await logRewardEvent({
            context: logContext,
            level: 'warn',
            category: 'reward_code',
            message: msg,
            clientId: clientId.toString(),
            rewardId: task.reward._id.toString(),
          });
        }
      }
    } catch (err: any) {
      // Auth errors mean the merchant's Shopify connection is broken.
      // We log clearly but DO NOT re-throw — the player's match stats and
      // achievements must still be saved even if a reward code fails.
      const isAuthError =
        err.message?.includes('Client or Shopify credentials missing') ||
        err.message?.includes('401') ||
        err.message?.includes('Token refresh failed') ||
        err.message?.includes('merchant must reconnect');

      if (isAuthError) {
        const msg =
          `AUTH FAILURE for client ${clientId} — Shopify token is invalid and could not be ` +
          `refreshed. Reward ${task.reward._id} skipped. Merchant must reconnect Shopify.`;

        console.error(`[RewardCode] ⚠️ ${msg}`);
        errors?.add('auth_error');

        if (logContext) {
          await logRewardEvent({
            context: logContext,
            level: 'error',
            category: 'auth_error',
            message: msg,
            clientId: clientId.toString(),
            rewardId: task.reward._id.toString(),
            metadata: { errorMessage: err.message },
          });
        }
      } else {
        const msg =
          `Unexpected error creating Shopify discount for reward ${task.reward._id}: ${err.message}`;
        console.error(`[RewardCode] ${msg}`);

        if (logContext) {
          await logRewardEvent({
            context: logContext,
            level: 'error',
            category: 'reward_code',
            message: msg,
            clientId: clientId.toString(),
            rewardId: task.reward._id.toString(),
            metadata: { errorMessage: err.message },
          });
        }
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
    } catch (err: any) {
      const msg = `Failed to save Shopify reward codes to DB: ${err.message}`;
      console.error(`[RewardCode] ${msg}`);

      if (logContext) {
        await logRewardEvent({
          context: logContext,
          level: 'error',
          category: 'reward_code',
          message: msg,
          clientId: clientId.toString(),
          metadata: { errorMessage: err.message },
        });
      }
    }
  }

  return result;
}