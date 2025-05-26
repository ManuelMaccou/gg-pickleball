import mongoose, { Schema } from "mongoose";
import { IReward } from "../types/databaseTypes";


const RewardSchema = new Schema<IReward>(
  {
    index: { type: Number },
    name: { type: String },
    friendlyName: { type: String },
    type: {
      type: String,
      enum: ['dollar', 'percent'],
    },
    category: {
      type: String,
      enum: ['retail', 'programming'],
    },
    product: {
      type: String,
      enum: ['open play', 'reservation', 'shop gear'],
    },
    discount: { type: Number },
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);