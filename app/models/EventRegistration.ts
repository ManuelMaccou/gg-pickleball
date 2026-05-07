import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { IEventRegistration } from '../types/databaseTypes';

const EventRegistrationSchema = new Schema<IEventRegistration>(
  {
    event: { type: Schema.Types.ObjectId, ref: 'ClubEvent', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    duprId: { type: String, required: true, trim: true },

    duprPlusVerifiedAtRegistration: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      enum: ['registered', 'cancelled'],
      required: true,
      default: 'registered',
    },
    registeredAt: { type: Date, required: true, default: Date.now },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// One active registration per user per event. The unique index covers the
// common "is this user registered?" query and prevents double-registration
// at the database level (defense-in-depth alongside the API check).
//
// Note: this index does not distinguish between 'registered' and 'cancelled'
// statuses, so when un-registration is implemented in the next iteration,
// either (a) cancelled registrations get deleted instead of soft-deleted, or
// (b) this becomes a partial index filtered to status: 'registered'. Flagging
// here so it's not forgotten.
EventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

// Supports "what events is this user registered for?" queries on /play.
EventRegistrationSchema.index({ user: 1, status: 1 });

export const EventRegistration: Model<IEventRegistration> =
  mongoose.models.EventRegistration ||
  mongoose.model<IEventRegistration>('EventRegistration', EventRegistrationSchema);