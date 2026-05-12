// app/models/StripeCustomer.ts
//
// Maps a Client document to a Stripe Customer and their saved payment method.
// One record per client. Created when the brand admin first sets up billing.

import mongoose, { Schema, Model } from 'mongoose';
import { IStripeCustomer } from '../types/databaseTypes';

const StripeCustomerSchema = new Schema<IStripeCustomer>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      unique: true, // One Stripe customer per client
    },
    stripeCustomerId: { type: String, required: true, unique: true },
    stripePaymentMethodId: { type: String },
    billingEmail: { type: String, required: true },
    cardLast4: { type: String },
    cardBrand: { type: String },
    cardExpMonth: { type: Number },
    cardExpYear: { type: Number },
    bankLast4: { type: String },
    bankName: { type: String },
  },
  { timestamps: true }
);

StripeCustomerSchema.index({ clientId: 1 });
StripeCustomerSchema.index({ stripeCustomerId: 1 });

export const StripeCustomer: Model<IStripeCustomer> =
  mongoose.models.StripeCustomer ||
  mongoose.model<IStripeCustomer>('StripeCustomer', StripeCustomerSchema);