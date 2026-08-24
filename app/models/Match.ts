import mongoose, { Schema, Model } from "mongoose";
import { IMatch } from "../types/databaseTypes";

const TeamSchema = new Schema({
  players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  playerNames: [{ type: String }], 
  score: { type: Number}
}, { _id: false });

const MatchSchema = new Schema<IMatch>(
  {
    matchId: { type: String, required: true, unique: true },
    duprMatchId: { type: Number },
    duprGameNumber: { type: Number },
    sourceMatchId: { type: String, unique: true, sparse: true },
    matchType: { type: String, enum: ['singles', 'doubles'] },
    programId: { type: Schema.Types.ObjectId, ref: 'Program' },
    division: { type: String },
    team1DuprIds: { type: [String] },
    team2DuprIds: { type: [String] },
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

MatchSchema.index({ location: 1 });
MatchSchema.index({ programId: 1 });
MatchSchema.index({ 'team1.players': 1 });
MatchSchema.index({ 'team2.players': 1 });
// Multikey indexes — MongoDB handles array-field
// indexes natively, so "does this match contain DUPR ID X" stays a cheap,
// indexed lookup even at scale, not a collection scan.
MatchSchema.index({ team1DuprIds: 1 });
MatchSchema.index({ team2DuprIds: 1 });
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

// Explicit `Model<IMatch>` annotation — without it, .lean() results on
// Match silently degrade to `unknown` in TypeScript, same root cause fixed
// in Program.ts. Not yet hit here since nothing calls Match.find().lean()
// yet, but the tournament-processing/idempotency-check code will.
const Match: Model<IMatch> =
  mongoose.models.Match || mongoose.model<IMatch>("Match", MatchSchema);

export default Match;