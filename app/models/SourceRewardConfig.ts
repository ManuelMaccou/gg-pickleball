import mongoose, { Schema } from 'mongoose';
import { ISourceRewardConfig, ISourceRewardSponsorship } from '../types/databaseTypes';

const SourceRewardSponsorshipSchema = new Schema<ISourceRewardSponsorship>({
  sponsoringClientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
}, { _id: false });

const SourceRewardConfigSchema = new Schema<ISourceRewardConfig>({
  achievementName: { type: String, required: true, unique: true },
  sponsorships: [SourceRewardSponsorshipSchema],
}, { timestamps: true });

export default mongoose.models.SourceRewardConfig || mongoose.model<ISourceRewardConfig>('SourceRewardConfig', SourceRewardConfigSchema);