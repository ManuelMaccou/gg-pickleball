import mongoose, { Schema } from "mongoose";
import { ISkippedDuprEntry } from "../types/databaseTypes";

const SkippedDuprEntrySchema = new Schema<ISkippedDuprEntry>(
  {
    duprMatchId: { type: String, required: true },
    duprId: { type: String }, // The ID we couldn't find
    playerName: { type: String },
    reason: { type: String }, // e.g. "No email found in Club directory"
    importJobId: { type: Schema.Types.ObjectId, ref: 'Job' }, // Link to the bulk upload job
  }, { timestamps: true }
);

export default mongoose.models.SkippedDuprEntry || mongoose.model("SkippedDuprEntry", SkippedDuprEntrySchema);