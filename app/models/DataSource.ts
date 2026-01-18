import mongoose, { Schema } from 'mongoose';
import { IDataSource } from '../types/databaseTypes'; // You will need to create this interface

const CredentialsSchema = new Schema({
  apiKey: { type: String },
  apiSecret: { type: String },
  // Add other potential credential fields here
}, { _id: false });

const DataSourceSchema = new Schema<IDataSource>({
  name: { type: String }, // e.g., "GG Pickleball Rewards", "Silly Pickles"
  type: { 
    type: String, 
    required: true, 
    unique: true,
    enum: ['dupr', 'silly_pickles', 'swish']
  },
  icon: { type: String },
  logo: { type: String},
  credentials: { type: CredentialsSchema },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.DataSource || mongoose.model<IDataSource>('DataSource', DataSourceSchema);