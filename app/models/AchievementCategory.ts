import mongoose, { Schema } from "mongoose";
import { IAchievementCategory } from "../types/databaseTypes";


const AchievementCategorySchema = new Schema<IAchievementCategory>(
  {
    name: { type: String },
    description: { type: String },
    milestones: [{ type: String }]
  }
);

export default mongoose.models.AchievementCategory || mongoose.model<IAchievementCategory>("AchievementCategory", AchievementCategorySchema);
