import mongoose, { Schema } from 'mongoose';
import { IRewardCode } from '../types/databaseTypes';
import { RewardSchema } from './Reward';

const RewardCodeSchema = new Schema<IRewardCode>({
  code: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // Never set a default. It will break the code.
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  achievementId: { type: Schema.Types.ObjectId, ref: 'Achievement' },
  reward: { type: RewardSchema},
  redeemed: { type: Boolean, default: false },
  redemptionDate: { type: Date },
  addedToPos: { type: Boolean },
  dataSourceId: { type: Schema.Types.ObjectId, ref: 'DataSource' },
  isGlobalReward: { type: Boolean, default: false },
}, { timestamps: true });

RewardCodeSchema.index({ code: 1 });
RewardCodeSchema.index({ clientId: 1, 'reward.name': 1 });
RewardCodeSchema.index({ userId: 1, isGlobalReward: 1 });

export default mongoose.models.RewardCode || mongoose.model<IRewardCode>('RewardCode', RewardCodeSchema);
