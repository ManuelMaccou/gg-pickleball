import mongoose, { Schema } from "mongoose";
import { IAchievement } from "../types/databaseTypes";


const AchievementSchema = new Schema<IAchievement>(
  {
    index: { type: Number },
    friendlyName: { type: String },
    name: { type: String },
    badge: { type: String }
  }
);

export default mongoose.models.Achievement || mongoose.model<IAchievement>("Achievement", AchievementSchema);
