import mongoose, { Schema } from "mongoose";
import { IClient } from "../types/databaseTypes";

const ShopifySubSchema = new Schema({
  shopDomain: { type: String },
  accessToken: { type: String },
  secret: { type: String },
});

const PodplaySubSchema = new Schema({
  accessToken: { type: String },
});

const ClientSchema = new Schema<IClient>({
  name: { type: String, required: true, unique: true },
  logo: { type: String },
  admin_logo: { type: String },
  icon: { type: String },
  latitude: { type: String },
  longitude: { type: String },
  achievements: [
    { type: Schema.Types.ObjectId, ref: 'Achievement', required: true,  default: [] },
  ],
  rewardsPerAchievement: {
    type: Map,
    of: { type: Schema.Types.ObjectId, ref: 'Reward' },
    default: {}
  },
  retailSoftware: {
    type: String,
    enum: ['shopify', 'playbypoint'],
  },
  reservationSoftware: {
    type: String,
    enum: ['playbypoint', 'podplay', 'courtreserve'],
  },
  shopify: { type: ShopifySubSchema },
  podplay: { type: PodplaySubSchema }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
