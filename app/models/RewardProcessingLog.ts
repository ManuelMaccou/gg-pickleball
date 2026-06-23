// app/models/RewardProcessingLog.ts
//
// Stores structured log events from reward processing runs.
// Written during match sync (player-triggered) when achievements are
// evaluated and reward codes are generated.
//
// One document per event — not per run — so the admin can filter
// by level, category, client, or player.

import mongoose, { Schema, Model } from 'mongoose';
import { IRewardProcessingLog } from '../types/databaseTypes';

const RewardProcessingLogSchema = new Schema<IRewardProcessingLog>(
  {
    // The player whose match sync triggered this event
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // The match being processed when the event occurred
    matchId: { type: String, required: true },
    // The brand client involved (populated on reward/auth events, not on achievement events)
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    // The reward involved (populated on reward code generation events)
    rewardId: { type: Schema.Types.ObjectId, ref: 'Reward' },

    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      required: true,
    },
    category: {
      type: String,
      enum: ['achievement', 'reward_code', 'auth_error', 'generator', 'general'],
      required: true,
    },
    message: { type: String, required: true },
    // Flexible extra context — achievement keys, error messages, etc.
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

RewardProcessingLogSchema.index({ userId: 1, createdAt: -1 });
RewardProcessingLogSchema.index({ clientId: 1, createdAt: -1 });
RewardProcessingLogSchema.index({ level: 1, createdAt: -1 });
RewardProcessingLogSchema.index({ category: 1, createdAt: -1 });

export const RewardProcessingLog: Model<IRewardProcessingLog> =
  mongoose.models.RewardProcessingLog ||
  mongoose.model<IRewardProcessingLog>('RewardProcessingLog', RewardProcessingLogSchema);