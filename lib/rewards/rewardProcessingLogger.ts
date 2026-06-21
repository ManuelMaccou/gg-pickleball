// lib/rewards/rewardProcessingLogger.ts
//
// Thin helper for writing structured reward processing log events to the DB.
// Used by generators and processGlobalMatch to surface errors and debug info
// that would otherwise only appear in server console logs.
//
// Writes are fire-and-forget (non-throwing) — a logging failure must never
// interrupt the match processing flow.

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { RewardProcessingLog } from '@/app/models/RewardProcessingLog';

export interface LogContext {
  userId: string;   // Player whose sync triggered this
  matchId: string;  // Match being processed
}

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'achievement' | 'reward_code' | 'auth_error' | 'generator' | 'general';

interface LogEventParams {
  context: LogContext;
  level: LogLevel;
  category: LogCategory;
  message: string;
  clientId?: string;
  rewardId?: string;
  metadata?: Record<string, unknown>;
}

export async function logRewardEvent(params: LogEventParams): Promise<void> {
  try {
    await connectToDatabase();
    await RewardProcessingLog.create({
      userId: new Types.ObjectId(params.context.userId),
      matchId: params.context.matchId,
      ...(params.clientId && { clientId: new Types.ObjectId(params.clientId) }),
      ...(params.rewardId && { rewardId: new Types.ObjectId(params.rewardId) }),
      level: params.level,
      category: params.category,
      message: params.message,
      metadata: params.metadata,
    });
  } catch (err) {
    // Never throw — logging must not interrupt match processing
    console.error('[rewardProcessingLogger] Failed to write log entry:', err);
  }
}