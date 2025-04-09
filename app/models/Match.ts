import mongoose, { Schema, Document } from "mongoose";
import { IMatch } from "../types/databaseTypes";

const MatchSchema = new Schema<IMatch & Document>(
  {
    day: { type: String }, // Monday
    date: { type: String }, // YYYY-MM-DD
    time: { type: String }, // 1:30-2pm
    location: { type:Schema.Types.ObjectId, ref: "Court" },
    teams: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    challenger: { type: Schema.Types.ObjectId, ref: "Team" },
    status: {
      type: String,
      enum: ["PENDING", "BOOKED", "COMPLETED", "CANCELED"],
      default: "PENDING",
    },
    scores: {
      items: [
        {
          teamId: { type: Schema.Types.ObjectId, ref: "Team" },
          score: { type: Number },
          submittingTeam: { type: Schema.Types.ObjectId, ref: "Team" },
        },
      ],
      confirmed: { type: Boolean, default: false },
    },
    winner: {
      teamId: { type: Schema.Types.ObjectId, ref: "Team" },
      score: { type: Number },
    },
    loser: {
      teamId: { type: Schema.Types.ObjectId, ref: "Team" },
      score: { type: Number },
    },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    regionId: { type: Schema.Types.ObjectId, ref: "Region" },
    playersPaid: [{ type: Schema.Types.ObjectId, ref: "User" }],
    stripePaymentIntent: [{ type: String }],
  },
  { timestamps: true }
);

// Indexing for fast queries
MatchSchema.index({ seasonId: 1 });
MatchSchema.index({ teams: 1 });
MatchSchema.index({ status: 1 });

export default mongoose.models.Match || mongoose.model<IMatch & Document>("Match", MatchSchema);
