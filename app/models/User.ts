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
    name: { type: String },
    email: { type: String },
    profilePicture: { type: String },
    duprUrl: { type: String },
    dupr: { type: Number },
    skillLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
    availability: { type: [UserAvailabilitySchema] },
    wins: { type: Number },
    losses: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser & Document>("User", UserSchema);
