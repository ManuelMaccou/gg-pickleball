import mongoose, { Schema } from "mongoose";
import { IAchievement } from "../types/databaseTypes";


const AchievementSchema = new Schema<IAchievement>(
  {
    name: { type: String },
  }
);

export default mongoose.models.Achievement || mongoose.model<IAchievement>("Achievement", AchievementSchema);
