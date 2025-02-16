import mongoose, { Schema, Document } from "mongoose";
import { IConversation } from "../types/databaseTypes";

const ConversationSchema = new Schema<IConversation & Document>(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    users: [{ type: Schema.Types.ObjectId, ref: "User"}],
  },
  { timestamps: true }
);

ConversationSchema.index({ seasonId: 1, users: 1 }); // Covers season-based searches
ConversationSchema.index({ users: 1 });

export default mongoose.models.Conversation ||
  mongoose.model<IConversation & Document>("Conversation", ConversationSchema);
