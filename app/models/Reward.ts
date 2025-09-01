import mongoose, { Schema } from "mongoose";
import { IReward } from "../types/databaseTypes";


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
      enum: ['open play', 'reservations', 'guest reservations', 'classes and clinics', 'pro shop', 'custom'],
    },
    productDescription: { type: String },
    discount: { type: Number },
    minimumSpend: { type: Number },
    maxDiscount: { type: Number }
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);