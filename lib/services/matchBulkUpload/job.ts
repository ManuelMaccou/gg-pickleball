import Job from '@/app/models/Job';
import { Job as IJob, JobResult } from '@/app/types/bulkUploadTypes';
import { Types } from 'mongoose';

/**
 * A centralized service for managing bulk upload jobs using MongoDB.
 */
export const jobService = {
  async create(): Promise<string> {
    const newJob = await Job.create({ status: 'processing', results: [] });
    return newJob._id.toString();
  },

  async addResult(jobId: string, result: JobResult): Promise<void> {
    await Job.updateOne({ _id: new Types.ObjectId(jobId) }, { $push: { results: result } });
  },

  async complete(jobId: string, status: 'complete' | 'failed'): Promise<void> {
    await Job.updateOne({ _id: new Types.ObjectId(jobId) }, { $set: { status } });
  },

  async get(jobId: string): Promise<IJob | null> {
    return await Job.findById(jobId);
  },

  async delete(jobId: string): Promise<void> {
    await Job.deleteOne({ _id: new Types.ObjectId(jobId) });
  }
};