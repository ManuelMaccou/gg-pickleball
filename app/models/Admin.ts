import mongoose, { Schema } from "mongoose";
import { ADMIN_PERMISSION_TYPES, IAdmin } from "../types/databaseTypes";


const AdminSchema = new Schema<IAdmin>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    location: { type: Schema.Types.ObjectId, ref: 'Client' },
    permission: {
      type: String,
      enum: ADMIN_PERMISSION_TYPES, 
      default: "associate"
    },
    clientName: { type: String },
    name: { type: String },
  }
);

export default mongoose.models.Admin || mongoose.model<IAdmin>("Admin", AdminSchema);
