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
      enum: ['retail', 'programming'],
    },
    product: {
      type: String,
      enum: ['open play', 'reservation', 'pro shop'],
    },
    discount: { type: Number },
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);