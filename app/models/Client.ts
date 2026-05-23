import mongoose, { Schema } from "mongoose";
import { IClient } from "../types/databaseTypes";

const ShopifySubSchema = new Schema({
  shopDomain: { type: String },
  shopId: { type: String },
  accessToken: { type: String },
  secret: { type: String },
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  refreshTokenExpiresAt: { type: Date },
}, { _id: false });

const PodplaySubSchema = new Schema({
  accessToken: { type: String },
}, { _id: false });

const PlayByPointSubSchema = new Schema({
  facilityId: { type: Number },
  affiliations: [{ type: String }]
}, { _id: false });

const DuprSubSchema = new Schema({
  id: { type: String },
}, { _id: false });

const ClientSchema = new Schema<IClient>({
  active: { type: Boolean, default: false },
  locationType: { type: String, default: 'facility' },
  name: { type: String, required: true, unique: true },
  dupr: { type: DuprSubSchema },
  logo: { type: String },
  cardBackgroundImage: { type: String },
  cardTextColor: { 
    type: String, 
    default: '#ffffff' // Default to White
  },
  admin_logo: { type: String },
  bannerColor: { type: String, default: 'white'},
  icon: { type: String },
  rewardProducts: {
    type: [String],
    default: []
  },
  latitude: { type: Number },
  longitude: { type: Number },
  altAchievements: [
    { type: Schema.Types.ObjectId, ref: 'Achievement', required: true,  default: [] },
  ],
  altRewardsPerAchievement: {
    type: Map,
    of: { type: Schema.Types.ObjectId, ref: 'Reward' },
    default: {}
  },
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
  rewardConfigStatus: {
    type : String ,
    enum: ['pending', 'active'],
    default: 'active',
  },
  shopify: { type: ShopifySubSchema },
  playbypoint: { type: PlayByPointSubSchema },
  podplay: { type: PodplaySubSchema },
  needsRetroactiveSweep: { 
    type: Boolean, 
    default: true // New clients default to TRUE (they need a sweep)
  }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
