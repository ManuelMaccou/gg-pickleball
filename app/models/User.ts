import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/databaseTypes";

const AchievementSubSchema = new Schema({
  count: { type: Number },
  earnedAt: { type: [Date], required: true },
}, { _id: false })

const RewardSubSchema = new Schema({
  redeemed: { type: Boolean, required: true },
  redemptionDate: { type: Date },
}, { _id: false })

const ClientStatsSubSchema = new Schema({
  checkins: {
    type: [Date],
    default: [],
  },
  wins: { type: Number },
  losses: { type: Number },
  winStreak: { type: Number },
  pointsWon: { type: Number },
  matches: [{ type: Schema.Types.ObjectId, ref: "Match" }],
  achievements: {
    type: Map,
    of: AchievementSubSchema,
    default: {}
  },
  rewards: {
    type: Map,
    of: RewardSubSchema,
    default: {}
  }
}, { _id: false })


const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    auth0Id: { type: String },
    profilePicture: { type: String },
    lastLocation: { type: Schema.Types.ObjectId, ref: "Client" },
    stats: {
      type: Map,
      of: ClientStatsSubSchema,
      default: {}
    }
  }, { timestamps: true }
);

UserSchema.index({ auth0Id: 1 });

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
