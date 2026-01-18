import mongoose, { Schema } from 'mongoose';
import { ISourceRewardConfig, ISourceRewardSponsorship } from '../types/databaseTypes';

const SourceRewardSponsorshipSchema = new Schema<ISourceRewardSponsorship>({
  sponsoringClientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
}, { _id: false });

const SourceRewardConfigSchema = new Schema<ISourceRewardConfig>({
  dataSourceId: { type: Schema.Types.ObjectId, ref: 'DataSource', required: true },
  achievementName: { type: String, required: true }, // e.g., "5-dupr-matches-won"
  // This part is the same as your old schema, defining the sponsors for this achievement
  sponsorships: [SourceRewardSponsorshipSchema], 
}, { timestamps: true });

// Add an index for efficient lookups
SourceRewardConfigSchema.index({ dataSourceId: 1, achievementName: 1 });

export default mongoose.models.SourceRewardConfig || mongoose.model<ISourceRewardConfig>('SourceRewardConfig', SourceRewardConfigSchema);