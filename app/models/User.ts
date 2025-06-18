import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/databaseTypes";

const AchievementSubSchema = new Schema({
  achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", required: true },
  name: { type: String },
  earnedAt: { type: Date, required: true },
});

const RewardSubSchema = new Schema({
  rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
  earnedAt: { type: Date, required: true },
  rewardCodeId: { type: Schema.Types.ObjectId, ref: "RewardCode" },
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
  matches: [{ type: Schema.Types.ObjectId, ref: "Match" }],
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
  duprId: { type: String },
  email: { type: String },
  activated: { type: Boolean, default: false },
})


const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    auth0Id: { type: String },
    profilePicture: { type: String },
    dupr: { type: DuprSchema },
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
