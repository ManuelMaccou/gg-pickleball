import mongoose, { Schema, Document } from "mongoose";
import { IGguprMatch } from "../types/databaseTypes";

const GguprMatchSchema = new Schema<IGguprMatch & Document>(
  {
    matchId: { type: String, required: true, unique: true },
    team1: {
      players: [{ type: Schema.Types.ObjectId, ref: "GguprUser" }], // Array of players
      score: { type: Number },
    },
    team2: {
      players: [{ type: Schema.Types.ObjectId, ref: "GguprUser" }], // Array of players
      score: { type: Number},
    },
    winners: [{ type: Schema.Types.ObjectId, ref: "GguprUser" }], // Array of players
  },
  { timestamps: true }
);

export default mongoose.models.GguprMatch || mongoose.model<IGguprMatch & Document>("GguprMatch", GguprMatchSchema);
