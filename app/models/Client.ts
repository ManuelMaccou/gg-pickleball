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
  // Tracks whether the merchant has an active Shopify app subscription.
  // Set by the OAuth callback and kept in sync by the shopify-status route.
  // A merchant can have valid credentials but no plan if they closed the
  // pricing page before selecting one — in that state the integration won't
  // work and the onboarding checklist should prompt them to select a plan.
  hasActivePlan: { type: Boolean, default: false },
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
    default: '#ffffff'
  },
  admin_logo: { type: String },
  bannerColor: { type: String, default: 'white' },
  icon: { type: String },
  rewardProducts: {
    type: [String],
    default: []
  },
  latitude: { type: Number },
  longitude: { type: Number },
  altAchievements: [
    { type: Schema.Types.ObjectId, ref: 'Achievement', required: true, default: [] },
  ],
  altRewardsPerAchievement: {
    type: Map,
    of: { type: Schema.Types.ObjectId, ref: 'Reward' },
    default: {}
  },
  achievements: [
    { type: Schema.Types.ObjectId, ref: 'Achievement', required: true, default: [] },
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
    type: String,
    enum: ['pending', 'active'],
    default: 'active',
  },
  shopify: { type: ShopifySubSchema },
  playbypoint: { type: PlayByPointSubSchema },
  podplay: { type: PodplaySubSchema },
  needsRetroactiveSweep: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);