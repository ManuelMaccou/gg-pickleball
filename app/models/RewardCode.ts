import mongoose, { Schema } from 'mongoose';
import { IRewardCode } from '../types/databaseTypes';
import { RewardSchema } from './Reward';

const RewardCodeSchema = new Schema<IRewardCode>({
  code: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  achievementId: { type: Schema.Types.ObjectId, ref: 'Achievement' },
  reward: { type: RewardSchema},
  redeemed: { type: Boolean, default: false },
  redemptionDate: { type: Date },
}, { timestamps: true });

RewardCodeSchema.index({ code: 1 });

export default mongoose.models.RewardCode || mongoose.model<IRewardCode>('RewardCode', RewardCodeSchema);
