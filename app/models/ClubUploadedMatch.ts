import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { IClubUploadedMatch, IUploadedMatchPlayer, IUploadedMatchTeam } from '../types/databaseTypes';

// NOTE: validation (4 players present, scores valid, etc) lives in the
// frontend form and any future bulk-import processor — not in the schema.
const PlayerSchema = new Schema<IUploadedMatchPlayer>(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    duprId: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const TeamSchema = new Schema<IUploadedMatchTeam>(
  {
    player1: { type: PlayerSchema, required: true },
    player2: { type: PlayerSchema, required: true },
    game1: { type: Number, default: 0 },
    game2: { type: Number, default: 0 },
    game3: { type: Number, default: 0 },
    game4: { type: Number, default: 0 },
    game5: { type: Number, default: 0 },
  },
  { _id: false }
);

const ClubUploadedMatchSchema = new Schema<IClubUploadedMatch>(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'ClubEvent', index: true },
    createdByAdmin: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    matchDate: { type: Date, required: true },
    teamA: { type: TeamSchema, required: true },
    teamB: { type: TeamSchema, required: true },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },

    duprSubmissionStatus: {
      type: String,
      enum: ['draft', 'pending', 'submitted', 'failed'],
      default: 'draft',
      index: true,
    },
    duprMatchId: { type: String, trim: true, index: true },
    duprSubmissionError: { type: String },
    submittedAt: { type: Date },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

ClubUploadedMatchSchema.index({ club: 1, deletedAt: 1, matchDate: -1 });

export const ClubUploadedMatch: Model<IClubUploadedMatch> =
  mongoose.models.ClubUploadedMatch ||
  mongoose.model<IClubUploadedMatch>('ClubUploadedMatch', ClubUploadedMatchSchema);