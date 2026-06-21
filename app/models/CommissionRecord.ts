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
    shopifyEventKey: { type: String },
    stripeInvoiceId: { type: String },
    stripePaymentIntentId: { type: String },

    orderCreatedAt: { type: Date, required: true },
    chargeAfter: { type: Date, required: true },
    nextCheckAt: { type: Date, required: true },
    lastCheckedAt: { type: Date },

    status: {
      type: String,
      enum: ['pending', 'held', 'charged', 'waived', 'review', 'processing'],
      required: true,
      default: 'pending',
    },

    holdReason: {
      type: String,
      enum: ['unfulfilled', 'return_in_progress', 'dispute_active', 'partial_refund_open', null],
      default: null,
    },

    reviewNote: { type: String },
  },
  { timestamps: true }
);

CommissionRecordSchema.index({ status: 1, nextCheckAt: 1 });
CommissionRecordSchema.index({ shopifyOrderId: 1, discountCode: 1 }, { unique: true });
CommissionRecordSchema.index({ clientId: 1, status: 1 });
CommissionRecordSchema.index({ status: 1, holdReason: 1 });
// Look up by Stripe invoice ID for webhook handler
CommissionRecordSchema.index({ stripeInvoiceId: 1 });

export const CommissionRecord: Model<ICommissionRecord> =
  mongoose.models.CommissionRecord ||
  mongoose.model<ICommissionRecord>('CommissionRecord', CommissionRecordSchema);