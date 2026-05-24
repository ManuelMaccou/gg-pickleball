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
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email:          { type: String, required: true },

    // Identity fields (Section 2.4 + Section 13)
    legalCompanyName: { type: String },   // Legal entity name — not displayed publicly
    brandName:        { type: String },   // Public-facing brand name
    applicantTitle:   { type: String },   // Job title / role of the accepting individual

    // Brand info (Section 2.2)
    website:          { type: String },
    description:      { type: String },
    shopifyConfirmed: { type: Boolean, default: false },

    // Application lifecycle
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      required: true,
      default: 'draft',
    },

    // Review fields
    reviewNote:   { type: String },
    reviewedAt:   { type: Date },
    reviewedBy:   { type: Schema.Types.ObjectId, ref: 'User' },

    // Set after approval — links the application to the Client that was created
    clientId:     { type: Schema.Types.ObjectId, ref: 'Client' },

    submittedAt:  { type: Date },

    // Legal acceptance audit trail (Section 13)
    // Captured automatically at submission — not entered by the user
    agreementVersion: { type: String },   // e.g. '1.0'
    acceptedAt:       { type: Date },     // Timestamp of submission
    acceptedIp:       { type: String },   // IP address of the submitting request
    authorityConfirmed: { type: Boolean, default: false }, // "I have authority to bind my company"
    agreementAccepted:  { type: Boolean, default: false }, // "I agree to the Brand Partner Agreement"
  },
  { timestamps: true }
);

// One draft per user
BrandApplicationSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'draft' } }
);
// Brand name collision checks
BrandApplicationSchema.index({ brandName: 1, status: 1 });
BrandApplicationSchema.index({ legalCompanyName: 1, status: 1 });
// Admin list queries
BrandApplicationSchema.index({ status: 1, createdAt: -1 });

export const BrandApplication: Model<IBrandApplication> =
  mongoose.models.BrandApplication ||
  mongoose.model<IBrandApplication>('BrandApplication', BrandApplicationSchema);