import mongoose, { Schema } from "mongoose";
import { IDuprImportError } from "../types/databaseTypes";

const DuprImportErrorSchema = new Schema<IDuprImportError>(
  {
    importJobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    duprMatchId: { type: String },
    duprId: { type: String },
    playerName: { type: String },
    
    // validation = Skipped due to missing data/email
    // processing = Failed due to database/server error
    errorType: { 
        type: String, 
        enum: ['validation', 'processing'], 
        required: true 
    },
    
    reason: { type: String, required: true },
    rawData: { type: Schema.Types.Mixed }, // Stores the match JSON for debugging
  }, { timestamps: true }
);

export default mongoose.models.DuprImportError || mongoose.model<IDuprImportError>("DuprImportError", DuprImportErrorSchema);