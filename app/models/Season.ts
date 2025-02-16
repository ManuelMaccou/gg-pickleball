import mongoose, { Schema, Document } from "mongoose";
import { ISeason } from "../types/databaseTypes";

const SeasonSchema = new Schema<ISeason & Document>(
  {
    season: { type: Number },
    startDate: { type: String }, // YYYY-MM-DD
    active: { type: Boolean }
  },
  { timestamps: true }
);

// Index for efficient querying by season
SeasonSchema.index({ season: 1 });

export default mongoose.models.Season || mongoose.model<ISeason & Document>("Season", SeasonSchema);
