import mongoose, { Schema, Document } from "mongoose";
import { ITeam } from "../types/databaseTypes";

const TeamSchema = new Schema<ITeam & Document>(
  {
    teammates: [{ type: Schema.Types.ObjectId, ref: "User" }],
    captain: { type: Schema.Types.ObjectId, ref: "User" },
    preferredCourt: { type: Schema.Types.ObjectId, ref: "Court" },
    wins: { type: Number },
    losses: { type: Number },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    regionId: { type: Schema.Types.ObjectId, ref: "Region" },
    registrationStep: {
      type: String,
      enum: ["CAPTAIN_REGISTERED", "TEAMMATE_INVITED", "TEAMMATE_REGISTERED"],
    },
    status: {
      type: String,
      enum: ["REGISTERED", "PAYMENT_READY", "PAID"]
    },
    individual: { type: Boolean },
    teammatesPaid: [{ type: Schema.Types.ObjectId, ref: "User" }],
    stripePaymentIntent: [{ type: String }],
  },
  { timestamps: true }
);

TeamSchema.index({ seasonId: 1, teammates: 1 });

delete mongoose.models.Team;
export default mongoose.models.Team || mongoose.model<ITeam & Document>("Team", TeamSchema);
