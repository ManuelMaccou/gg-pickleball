import mongoose, { Schema } from "mongoose";
import { IClient } from "../types/databaseTypes";

const ShopifySubSchema = new Schema({
  shopDomain: { type: String },
  shopId: { type: String },
  installUrl: { type: String },
  accessToken: { type: String },
  secret: { type: String },
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  refreshTokenExpiresAt: { type: Date },
  // Per-client env var key for credential lookup in custom app mode.
  // e.g. "PADELHAUS" resolves to SHOPIFY_API_KEY_PADELHAUS / SHOPIFY_API_SECRET_PADELHAUS.
  // Set by us on the Client record before the merchant logs in.
  // Ignored in public app mode (shared credentials used instead).
  envKey: { type: String },
  // Tracks whether the merchant has an active billing relationship.
  // Custom mode: true when StripeCustomer.stripePaymentMethodId is set.
  // Public mode: true when an active Shopify App Pricing subscription exists.
  // Set by the OAuth callback and kept in sync by the shopify-status route.
  hasActivePlan: { type: Boolean, default: false },
  planHandle: { type: String },
  uninstalledAt: { type: Date },
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