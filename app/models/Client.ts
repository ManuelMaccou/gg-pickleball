import mongoose, { Schema } from "mongoose";
import { IClient } from "../types/databaseTypes";

const ClientSchema = new Schema<IClient>({
  name: { type: String, required: true, unique: true },
  logo: { type: String },
  icon: { type: String },
  latitude: { type: String },
  longitude: { type: String },
  achievements: [
    { type: Schema.Types.ObjectId, ref: 'Achievement', required: true }
  ],
  rewardsPerAchievement: {
    type: Map,
    of: { type: Schema.Types.ObjectId, ref: 'Reward' },
    default: {}
  }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
