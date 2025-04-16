import mongoose, { Schema } from "mongoose";
import { IReward } from "../types/databaseTypes";


const RewardSchema = new Schema<IReward>(
  {
    discount: { type: String },
    product: { type: String },
    name: { type: String },
    achievement: { type: String }
  }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);
