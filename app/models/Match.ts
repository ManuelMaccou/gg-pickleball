import mongoose, { Schema, Document } from "mongoose";
import { IMatch } from "../types/databaseTypes";

const MatchSchema = new Schema<IMatch & Document>(
  {
    teams: [{ type: Schema.Types.ObjectId, ref: "Team"}],
    challenger: { type: Schema.Types.ObjectId, ref: "Team" },
    status: {
      type: String,
      enum: ["INITIATED", "PAID", "COMPLETED", "CANCELED"],
      default: "INITIATED",
    },
    winner: {
      team: { type: Schema.Types.ObjectId, ref: "Team" },
      score: { type: Number },
    },
    loser: {
      team: { type: Schema.Types.ObjectId, ref: "Team" },
      score: { type: Number },
    },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
  },
  { timestamps: true }
);

// Indexing for fast queries
MatchSchema.index({ seasonId: 1 });
MatchSchema.index({ teams: 1 });
MatchSchema.index({ status: 1 });

export default mongoose.models.Match || mongoose.model<IMatch & Document>("Match", MatchSchema);
