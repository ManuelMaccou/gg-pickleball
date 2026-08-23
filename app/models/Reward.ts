import mongoose, { Schema } from "mongoose";
import { IReward } from "../types/databaseTypes";

const DiscountProductSelectionSchema = new Schema({
  productId: { type: String, required: true },
  title: { type: String, required: true },
}, { _id: false });

const DiscountCollectionSelectionSchema = new Schema({
  collectionId: { type: String, required: true },
  title: { type: String, required: true },
}, { _id: false });

const DiscountItemSelectionSchema = new Schema({
  all: { type: Boolean },
  products: { type: [DiscountProductSelectionSchema], default: undefined },
  collections: { type: [DiscountCollectionSelectionSchema], default: undefined },
}, { _id: false });

const BxgyConfigSchema = new Schema({
  buys: { type: DiscountItemSelectionSchema, required: true },
  buyQuantity: { type: Number, required: true },
  gets: { type: DiscountItemSelectionSchema, required: true },
  getQuantity: { type: Number, required: true },
  getPercent: { type: Number },
}, { _id: false });

export const RewardSchema = new Schema<IReward>(
  {
    index: { type: Number },
    name: { type: String },
    friendlyName: { type: String },
    type: {
      type: String,
      enum: ['dollars', 'percent'],
    },
    category: {
      type: String,
      enum: ['retail', 'programming', 'custom'],
    },
    product: {
      type: String,
      enum: ['open play', 'reservations', 'guest reservations', 'classes and clinics', 'pro shop', 'online store', 'in store', 'custom'],
    },
    productDescription: { type: String },
    discount: { type: Number },
    minimumSpend: { type: Number },
    discountKind: { type: String, enum: ['amount', 'bxgy'], default: 'amount' },
    shopifyTargeting: { type: DiscountItemSelectionSchema },
    bxgy: { type: BxgyConfigSchema },
    combinesWithOtherDiscounts: { type: Boolean, default: false }
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);