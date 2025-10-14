import mongoose, { Schema, Document } from 'mongoose';
import { Job, JobResult } from '@/app/types/bulkUploadTypes'; // Import the pure interface

// This interface is only used internally by the model file.
export interface IJob extends Job, Document {}

const JobResultSchema = new Schema<JobResult>({
  row: { type: Number, required: true },
  status: { type: String, enum: ['success', 'user_error', 'server_error'], required: true },
  message: { type: String, required: true },
  data: {
    players: [String],
    score: String,
  },
}, { _id: false });

const JobSchema = new Schema<IJob>({
  status: { type: String, enum: ['processing', 'complete', 'failed'], required: true },
  results: { type: [JobResultSchema], default: [] },
  createdAt: { type: Date, expires: '1h', default: Date.now }
});

export default mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);