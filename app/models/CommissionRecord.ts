import mongoose, { Schema, Model } from 'mongoose';
import { ICommissionRecord } from '../types/databaseTypes';

const CommissionRecordSchema = new Schema<ICommissionRecord>(
  {
    shopifyOrderId: { type: String, required: true },
    shopifyOrderGid: { type: String, required: true },
    shopDomain: { type: String, required: true },
    discountCode: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },

    orderTotal: { type: Number, required: true },
    refundedAmount: { type: Number, required: true, default: 0 },
    commissionRate: { type: Number, required: true, default: 0.05 },
    commissionAmount: { type: Number, required: true },

    orderCreatedAt: { type: Date, required: true },
    chargeAfter: { type: Date, required: true },
    nextCheckAt: { type: Date, required: true },
    lastCheckedAt: { type: Date },

    status: {
      type: String,
      enum: ['pending', 'held', 'charged', 'waived', 'review'],
      required: true,
      default: 'pending',
    },
    stripePaymentIntentId: { type: String },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

// Cron queries this index on every run — must be fast.
CommissionRecordSchema.index({ status: 1, nextCheckAt: 1 });
// Prevent duplicate commission records for the same order.
CommissionRecordSchema.index({ shopifyOrderId: 1, discountCode: 1 }, { unique: true });
// Look up commissions by client for the admin billing UI.
CommissionRecordSchema.index({ clientId: 1, status: 1 });

export const CommissionRecord: Model<ICommissionRecord> =
  mongoose.models.CommissionRecord ||
  mongoose.model<ICommissionRecord>('CommissionRecord', CommissionRecordSchema);