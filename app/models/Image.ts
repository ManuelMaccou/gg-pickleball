import mongoose from 'mongoose';
import { IImage } from '../types/databaseTypes';

const ImageSchema = new mongoose.Schema({
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
}, { timestamps: true });

export default mongoose.models.Image || mongoose.model<IImage & Document>("Image", ImageSchema);
