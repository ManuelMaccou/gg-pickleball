import mongoose, { Schema, Document } from "mongoose";
import { IConversation } from "../types/databaseTypes";

const ConversationSchema = new Schema<IConversation & Document>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match" },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
    messages: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        text: { type: String },
        systemMessage: { type: Boolean },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Optimized Indexes
ConversationSchema.index({ matchId: 1 });
ConversationSchema.index({ users: 1 });
ConversationSchema.index({ updatedAt: -1 });

export default mongoose.models.Conversation ||
  mongoose.model<IConversation & Document>("Conversation", ConversationSchema);
