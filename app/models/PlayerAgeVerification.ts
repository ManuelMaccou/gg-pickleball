// Destination: app/models/PlayerAgeVerification.ts
//
// [Eligibility check] Age only ever increases — once a DUPR ID is
// confirmed 13+, that fact is permanently true. So this registry only
// ever needs to record it ONCE, not re-verify or expire it. The mere
// EXISTENCE of a record for a given duprId is the entire signal; nothing
// here gets recomputed at lookup time.
//
// Populated for every 13+ Players Upload row, REGARDLESS of whether that
// row's identity reconciliation succeeded, linked to an existing account,
// or hit a conflict (see reconcilePlayerIdentity.ts) — this is the whole
// reason this is a SEPARATE collection from User rather than just a field
// on it: someone whose account is blocked behind an open
// PlayerIdentityIssue still had their age genuinely confirmed by the CSV
// row, and shouldn't lose that fact just because the account side of
// things didn't resolve.
//
// NOT consulted at all for a DUPR ID that already resolves to a real User
// account — accounts are only ever created for already-confirmed-13+
// rows, so an existing account already proves age, transitively, with no
// need to check this collection. This exists purely for the gap: DUPR IDs
// confirmed 13+ on some past roster, but with no linked account (yet).

import mongoose, { Schema, Model } from 'mongoose';
import { IPlayerAgeVerification } from '../types/databaseTypes';

const PlayerAgeVerificationSchema = new Schema<IPlayerAgeVerification>({
  duprId: { type: String, required: true, unique: true },

  // Exactly one of these is set, depending on `source` below.
  dateOfBirth: { type: String },     // source: 'players_upload', DOB given
  ageAtSubmission: { type: Number }, // source: 'players_upload', Age given instead
  birthYear: { type: Number },       // source: 'dupr_api'

  // [Step 4] Where this confirmation came from — a CSV roster row, or a
  // live DUPR API lookup triggered by a self-serve "check eligibility"
  // click from someone who was never on any roster.
  source: { type: String, enum: ['players_upload', 'dupr_api'], required: true },

  // Audit trail — which program's roster first confirmed this, and when.
  // OPTIONAL now — a dupr_api-sourced record has no originating program
  // roster at all. Not updated on subsequent uploads of the same DUPR ID
  // elsewhere (written via upsert + $setOnInsert) — the underlying fact
  // doesn't change, so there's nothing to gain from overwriting it.
  programId: { type: Schema.Types.ObjectId, ref: 'Program' },
  confirmedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

const PlayerAgeVerification: Model<IPlayerAgeVerification> =
  mongoose.models.PlayerAgeVerification ||
  mongoose.model<IPlayerAgeVerification>('PlayerAgeVerification', PlayerAgeVerificationSchema);

export default PlayerAgeVerification;