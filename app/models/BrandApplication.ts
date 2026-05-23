// app/models/BrandApplication.ts
//
// Tracks brand applications through their lifecycle:
//   draft     — user is authenticated but hasn't submitted the full form
//   pending   — full application submitted, awaiting admin review
//   approved  — admin approved; Client + Admin records created via createBrandClient/inviteAdminToClient
//   rejected  — admin rejected; reviewNote optional

import mongoose, { Schema, Model } from 'mongoose';
import { IBrandApplication } from '../types/databaseTypes';

const BrandApplicationSchema = new Schema<IBrandApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    brandName: { type: String },
    website: { type: String },
    description: { type: String },
    shopifyConfirmed: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      required: true,
      default: 'draft',
    },

    reviewNote: { type: String },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Set after approval — links the application to the Client that was created
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },

    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// One draft per user (drafts auto-resume on return)
BrandApplicationSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'draft' } }
);
// Look up by brand name for collision checks
BrandApplicationSchema.index({ brandName: 1, status: 1 });
// Admin list queries
BrandApplicationSchema.index({ status: 1, createdAt: -1 });

export const BrandApplication: Model<IBrandApplication> =
  mongoose.models.BrandApplication ||
  mongoose.model<IBrandApplication>('BrandApplication', BrandApplicationSchema);