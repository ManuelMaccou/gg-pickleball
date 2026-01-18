import mongoose, { Schema } from 'mongoose';
import { IGGRConfig, IGGRConfigSponsorship } from '../types/databaseTypes';

const GGRConfigSponsorshipSchema = new Schema<IGGRConfigSponsorship>({
  sponsoringClientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
}, { _id: false });

const GGRConfigSchema = new Schema<IGGRConfig>(
  {
    globalRewardConfig: {
      type: Map,
      of: [GGRConfigSponsorshipSchema],
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.models.GGRConfig || mongoose.model<IGGRConfig>('GGRConfig', GGRConfigSchema);