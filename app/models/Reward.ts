import mongoose, { Schema } from "mongoose";
import { IReward } from "../types/databaseTypes";


const RewardSchema = new Schema<IReward>(
  {
    name: { type: String },
    product: { type: String },
    discount: { type: String },
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);