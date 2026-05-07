import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { IClub } from '../types/databaseTypes';

const ClubAdminSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  duprRole: { type: String, enum: ['ORGANIZER', 'DIRECTOR'], required: true },
}, { _id: false });

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, trim: true },
    admins: [ClubAdminSchema],
    duprClubId: { type: String, trim: true },
  },
  { timestamps: true }
);

ClubSchema.index({ admins: 1 });

export const Club: Model<IClub> =
  mongoose.models.Club || mongoose.model<IClub>('Club', ClubSchema);