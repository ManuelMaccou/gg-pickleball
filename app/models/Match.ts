import mongoose, { Schema } from "mongoose";
import { IMatch } from "../types/databaseTypes";

const MatchSchema = new Schema<IMatch>(
  {
    matchId: { type: String, required: true, unique: true },
    team1: {
      players: [{ type: Schema.Types.ObjectId, ref: "User" }],
      score: { type: Number },
    },
    team2: {
      players: [{ type: Schema.Types.ObjectId, ref: "User" }],
      score: { type: Number},
    },
    winners: [{ type: Schema.Types.ObjectId, ref: "User" }],
    location: { type: Schema.Types.ObjectId, ref: "Client" },
    logToDupr: { type: Boolean },
  },
  { timestamps: true }
);

MatchSchema.index({ location: 1 });
MatchSchema.index({ 'team1.players': 1 });
MatchSchema.index({ 'team2.players': 1 });

export default mongoose.models.Match || mongoose.model<IMatch>("Match", MatchSchema);
