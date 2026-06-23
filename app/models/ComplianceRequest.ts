// app/models/ComplianceRequest.ts
//
// Tracks incoming Shopify compliance webhook requests.
// Visible in GG admin for manual fulfillment of customer data
// requests and customer redact requests.
// Shop redact requests are handled automatically and recorded here
// as an audit trail.

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IComplianceRequest } from '../types/databaseTypes';

const ComplianceRequestSchema = new Schema<IComplianceRequest>(
  {
    topic: {
      type: String,
      enum: ['customers/data_request', 'customers/redact', 'shop/redact'],
      required: true,
    },
    shopDomain: { type: String, required: true },
    customerId: { type: Number },
    customerEmail: { type: String },
    ordersReferenced: [{ type: Number }],
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    receivedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    completedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

// Index for the admin queue — pending requests sorted by due date
ComplianceRequestSchema.index({ status: 1, dueAt: 1 });
ComplianceRequestSchema.index({ shopDomain: 1 });

const ComplianceRequest: Model<IComplianceRequest> =
  mongoose.models.ComplianceRequest ||
  mongoose.model<IComplianceRequest>('ComplianceRequest', ComplianceRequestSchema);

export default ComplianceRequest;