import mongoose, { Schema, Document } from "mongoose";
import { ICourt, IAvailability } from "../types/databaseTypes";

const AvailabilitySchema = new Schema<IAvailability & Document>(
  {
    day: { type: String, required: true}, // Monday
    date: { type: String }, // YYYY-MM-DD
    time: { type: String }, // 1:30-2pm
    available: { type: Boolean },
  },
  { timestamps: true }
);

const CourtSchema = new Schema<ICourt & Document>(
  {
    name: { type: String },
    address: { type: String },
    regionId: { type: Schema.Types.ObjectId, ref: "Region" },
    availability: { type: [AvailabilitySchema] },
  },
  { timestamps: true }
);

export default mongoose.models.Court || mongoose.model<ICourt & Document>("Court", CourtSchema);
