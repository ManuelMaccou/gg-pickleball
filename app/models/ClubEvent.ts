import mongoose, { Schema, Model } from 'mongoose';
import { IClubEvent } from '../types/databaseTypes';

const ClubEventSchema = new Schema<IClubEvent>(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
    createdByAdmin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    notes: { type: String, trim: true },

    eventType: {
      type: String,
      enum: ['past', 'upcoming'],
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ['open', 'dupr_plus'],
      required: true,
      default: 'open',
    },
    location: { type: String, trim: true },
    description: { type: String, trim: true },
    registrationCount: { type: Number, required: true, default: 0, min: 0 },

    // published: false hides the event from the player feed.
    // Registered players still see it as "Cancelled" so they know it's off.
    // Defaults to true so existing events stay visible without a migration.
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ClubEventSchema.index({ club: 1, eventDate: -1 });
ClubEventSchema.index({ eventType: 1, eventDate: 1 });

ClubEventSchema.pre('validate', function (next) {
  if (this.isNew && this.eventType === 'upcoming') {
    const eventDateString = new Date(this.eventDate).toISOString().slice(0, 10);
    const todayString = new Date().toISOString().slice(0, 10);
    if (eventDateString < todayString) {
      return next(new Error('Upcoming events must be scheduled for today or a future date.'));
    }
  }
  if (this.eventType === 'past' && this.accessLevel === 'dupr_plus') {
    return next(new Error('Past events cannot be restricted to DUPR+ members.'));
  }
  next();
});

export const ClubEvent: Model<IClubEvent> =
  mongoose.models.ClubEvent || mongoose.model<IClubEvent>('ClubEvent', ClubEventSchema);