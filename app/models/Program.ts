import mongoose, { Schema, Model } from "mongoose";
import { IProgram } from "../types/databaseTypes";

const ProgramSchema = new Schema<IProgram>(
  {
    programApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "ProgramApplication",
      required: true,
    },
    name: { type: String, required: true },
    date: { type: String, required: true },
    club: { type: String, required: true },
  },
  { timestamps: true }
);

ProgramSchema.index({ programApplicationId: 1 });

const Program: Model<IProgram> =
  mongoose.models.Program || mongoose.model<IProgram>("Program", ProgramSchema);

export default Program;