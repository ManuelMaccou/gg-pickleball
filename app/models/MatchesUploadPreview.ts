// Destination: app/models/MatchesUploadPreview.ts

import mongoose, { Schema, Model } from "mongoose";
import { IMatchesUploadPreview } from "../types/databaseTypes";

const MatchRowSchema = new Schema(
  {
    rowNumber: { type: Number, required: true },
    sourceMatchId: { type: String },
    division: { type: String },
    matchType: { type: String, enum: ['singles', 'doubles'] },
    matchDate: { type: String },
    team1Score: { type: Number },
    team2Score: { type: Number },
    team1Player1DuprId: { type: String },
    team1Player2DuprId: { type: String },
    team2Player1DuprId: { type: String },
    team2Player2DuprId: { type: String },
    validationErrors: { type: [String], default: [] },
    // [Under-13 handling] NEW — non-blocking, unlike validationErrors.
    // Populated when a required-per-matchType player slot is blank —
    // could be a deliberate under-13 removal (the intended case) or a
    // genuine accidental omission (what this is here to catch). See
    // validateMatchRow.ts for exactly what triggers this.
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

const MatchesUploadPreviewSchema = new Schema<IMatchesUploadPreview>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    rows: { type: [MatchRowSchema], default: [] },
    fileErrors: { type: [String], default: [] },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

MatchesUploadPreviewSchema.index({ programId: 1 });

MatchesUploadPreviewSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 }
);

const MatchesUploadPreview: Model<IMatchesUploadPreview> =
  mongoose.models.MatchesUploadPreview ||
  mongoose.model<IMatchesUploadPreview>(
    "MatchesUploadPreview",
    MatchesUploadPreviewSchema
  );

export default MatchesUploadPreview;