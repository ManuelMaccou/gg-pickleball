import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProgramApplication extends Document {
  name: string;
  title: string;
  club: string;
  programName: string;
  programDate: Date;
  email: string;
  phone: string;
  authorityConfirmed: boolean;
  disclosureConfirmed: boolean;
  ipAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
}

const ProgramApplicationSchema = new Schema<IProgramApplication>({
  name: { type: String, required: true },
  title: { type: String, required: true },
  club: { type: String, required: true },
  programName: { type: String, required: true },
  programDate: { type: Date, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  authorityConfirmed: { type: Boolean, required: true },
  disclosureConfirmed: { type: Boolean, required: true },
  ipAddress: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
});

// Standard Next.js + Mongoose singleton pattern — avoids "Cannot overwrite model"
// errors during dev hot-reload.
export const ProgramApplication: Model<IProgramApplication> =
  mongoose.models.ProgramApplication ||
  mongoose.model<IProgramApplication>('ProgramApplication', ProgramApplicationSchema);