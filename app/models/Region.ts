import mongoose, { Schema, Document } from "mongoose";
import { IRegion } from "../types/databaseTypes";

const RegionSchema = new Schema<IRegion & Document>(
  {
    name: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Region || mongoose.model<IRegion & Document>("Region", RegionSchema);
