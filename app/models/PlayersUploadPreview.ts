// Destination: app/models/PlayersUploadPreview.ts

import mongoose, { Schema, Model } from "mongoose";
import { IPlayersUploadPreview } from "../types/databaseTypes";

const PlayerRowSchema = new Schema(
  {
    rowNumber: { type: Number, required: true },
    name: { type: String },
    email: { type: String },
    duprId: { type: String },
    dateOfBirth: { type: String },
    age: { type: Number },
    isUnder13: { type: Boolean, required: true },

    validationErrors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

const PlayersUploadPreviewSchema = new Schema<IPlayersUploadPreview>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    rows: { type: [PlayerRowSchema], default: [] },
    // File-level problems that block confirm regardless of per-row state —
    // e.g. no rows parsed at all, required columns missing entirely.
    fileErrors: { type: [String], default: [] },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

PlayersUploadPreviewSchema.index({ programId: 1 });
PlayersUploadPreviewSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 }
);

const PlayersUploadPreview: Model<IPlayersUploadPreview> =
  mongoose.models.PlayersUploadPreview ||
  mongoose.model<IPlayersUploadPreview>(
    "PlayersUploadPreview",
    PlayersUploadPreviewSchema
  );

export default PlayersUploadPreview;