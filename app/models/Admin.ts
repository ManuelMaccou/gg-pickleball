import mongoose, { Schema } from "mongoose";
import { IAdmin } from "../types/databaseTypes";


const AdminSchema = new Schema<IAdmin>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    location: { type: Schema.Types.ObjectId, ref: 'Client' },
    bannerColor: { type: String, default: 'white'},
  }
);

export default mongoose.models.Admin || mongoose.model<IAdmin>("Admin", AdminSchema);
