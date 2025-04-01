import mongoose, { Schema, Document } from "mongoose";
import { IGguprUser } from "../types/databaseTypes";


const GguprUserSchema = new Schema<IGguprUser & Document>(
  {
    name: { type: String, required: true, unique: true },
    auth0Id: { type: String },
    profilePicture: { type: String },
    wins: { type: Number },
    losses: { type: Number },
    matches: [{ type: Schema.Types.ObjectId, ref: "GguprMatch" }],
  },
  { timestamps: true }
);

export default mongoose.models.GguprUser || mongoose.model<IGguprUser & Document>("GguprUser", GguprUserSchema);
