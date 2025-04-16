import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/databaseTypes";

const AchievementSchema = new Schema(
  {
    count: { type: Number },
    earnedAt: { type: [Date], required: true },
  },
  { _id: false }
);


const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    auth0Id: { type: String },
    profilePicture: { type: String },
    wins: { type: Number },
    losses: { type: Number },
    winStreak: { type: Number },
    pointsWon: { types: Number },
    matches: [{ type: Schema.Types.ObjectId, ref: "Match" }],
    achievements: {
      type: Map,
      of: AchievementSchema,
      default: {},
    },
  },
  { timestamps: true }
);

UserSchema.index({ auth0Id: 1 });

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
