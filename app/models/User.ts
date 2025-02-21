import mongoose, { Schema, Document } from "mongoose";
import { IUser, IUserAvailability } from "../types/databaseTypes";

const UserAvailabilitySchema = new Schema<IUserAvailability & Document>(
  {
    day: { type: String }, // Monday
    date: { type: String }, // YYYY-MM-DD
    time: { type: String }, // 1:30-2pm
  },
  { _id: false }
);

const UserSchema = new Schema<IUser & Document>(
  {
    auth0Id: { type: String },
    firstTimeInvite: { type: Boolean },
    name: { type: String },
    email: { type: String },
    profilePicture: { type: String },
    duprUrl: { type: String },
    dupr: { type: Number },
    skillLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
    availability: { type: [UserAvailabilitySchema] },
    wins: { type: Number },
    losses: { type: Number },
    activeSeasons: [{  type: Schema.Types.ObjectId, ref: "Season" }],
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });

export default mongoose.models.User || mongoose.model<IUser & Document>("User", UserSchema);
