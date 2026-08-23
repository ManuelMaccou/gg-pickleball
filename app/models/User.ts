import mongoose, { Model, Schema } from "mongoose";
import { IUser } from "../types/databaseTypes";

export const AchievementSubSchema = new Schema({
  achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", required: true },
  name: { type: String },
  triggeringEvent: { type: String },
  earnedAt: { type: Date, required: true },
});

export const RewardSubSchema = new Schema({
  rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
  earnedAt: { type: Date, required: true },
  rewardCodeId: { type: Schema.Types.ObjectId, ref: "RewardCode" },
  sponsoringClientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  triggeringEvent: { type: String },
});

const ClientStatsSubSchema = new Schema({
  visits: {
    type: [Date],
    default: [],
  },
  lastVisit: { type: Date },
  wins: { type: Number },
  losses: { type: Number },
  winStreak: { type: Number },
  pointsWon: { type: Number },
  achievements: {
    type: [AchievementSubSchema],
    default: []
  },
  rewards: {
    type: [RewardSubSchema],
    default: []
  }
}, { _id: false })

const DuprSchema = new Schema({
  id: { type: String },
  rating: { type: Number },
  unverifiedId: { type: String },
  email: { type: String },
  userToken: { type: String },
  refreshToken: { type: String },
  hasBasicEntitlement: { type: Boolean },
  hasPremiumEntitlement: { type: Boolean },
  hasVerifiedEntitlement: { type: Boolean },
  entitlementCheckedAt: { type: Date },
  doublesRating: { type: Number },
  singlesRating: { type: Number },
  doublesCareerHigh: { type: Number },
  singlesCareerHigh: { type: Number },
  doublesProvisional: { type: Boolean },
  singlesProvisional: { type: Boolean },
  lastRatingUpdate: { type: Date },
}, { _id: false })


const UserSchema = new Schema<IUser>(
  {
    accountClaimed: { type: Boolean, default: false }, 
    brandOptin: { type: Boolean, default: false },

    // My own transaction emails, including "A new reward was unlocked. Log in to claim it."
    transactionalOptOut: { type: Boolean, default: false },
    marketingOptOut: { type: Boolean, default: false },
    name: { type: String, required: true},
    email: { type: String },
    auth0Id: { type: String },
    superAdmin: { type: Boolean },
    profilePicture: { type: String },
    dupr: { type: DuprSchema },
    stats: {
      type: Map,
      of: ClientStatsSubSchema,
      default: {}
    },
    identityUnresolved: { type: Boolean, default: false },
    pendingAgeReview: { type: Boolean, default: false },
    pendingAgeReviewReason: { type: String, enum: ['confirmed_under_13', 'unknown'] },
    pendingAgeReviewAt: { type: Date },
  }, { timestamps: true }
);

UserSchema.index({ auth0Id: 1 });
UserSchema.index({ name: 1 }, { collation: { locale: 'en', strength: 2 } });
UserSchema.index({ "dupr.id": 1 }, { unique: true, sparse: true });
UserSchema.index({ "stats.global.rewards.sponsoringClientId": 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
 
export default User;