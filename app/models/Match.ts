import mongoose, { Schema } from "mongoose";
import { IMatch } from "../types/databaseTypes";

const TeamSchema = new Schema({
  players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  playerNames: [{ type: String }], 
  score: { type: Number}
}, { _id: false });

const MatchSchema = new Schema<IMatch>(
  {
    dataSourceId: { type: Schema.Types.ObjectId, ref: 'DataSource' },
    matchId: { type: String, required: true, unique: true },
    duprMatchId: { type: Number },
    duprGameNumber: { type: Number },
    processedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    matchDate: { type: Date },
    team1: TeamSchema,
    team2: TeamSchema,
    winners: [{ type: Schema.Types.ObjectId, ref: "User" }],
    location: { type: Schema.Types.ObjectId, ref: "Client" },
    logToDupr: { type: Boolean },
  },
  { timestamps: true }
);

MatchSchema.index({ dataSourceId: 1 });
MatchSchema.index({ location: 1 });
MatchSchema.index({ 'team1.players': 1 });
MatchSchema.index({ 'team2.players': 1 });
MatchSchema.index(
  { duprMatchId: 1, duprGameNumber: 1, location: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      duprMatchId: { $exists: true },
      duprGameNumber: { $exists: true }
    } 
  }
);

export default mongoose.models.Match || mongoose.model<IMatch>("Match", MatchSchema);
