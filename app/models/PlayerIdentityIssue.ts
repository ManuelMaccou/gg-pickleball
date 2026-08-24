// Destination: app/models/PlayerIdentityIssue.ts
//
// Created whenever Players Upload reconciliation (see
// lib/programs/reconcilePlayerIdentity.ts) finds an email/DUPR ID conflict
// that can't be auto-resolved. Self-contained — stores the row's own data
// rather than a reference back to the CSV/preview, since a preview
// document may be long gone by the time this gets resolved.
//
// [Attempt log] submittedEmail/submittedDuprId/implicatedUserIds/
// conflictType are ALL immutable once set at creation. "Account X has
// this issue" needs to stay a stable, accurate fact regardless of how
// many resolve attempts happen afterward — those fields are what's
// actually flagged (identityUnresolved: true) in the database, so letting
// a failed attempt overwrite them would make the issue document lie about
// what's really flagged. Instead, every attempt (success or failure) gets
// logged to `attempts` below — purely informational, never feeds back
// into what's flagged or what the issue is "about."

import mongoose, { Schema, Model } from 'mongoose';
import { IPlayerIdentityIssue } from '../types/databaseTypes';

const AttemptSubSchema = new Schema({
  attemptedEmail: { type: String, required: true },
  attemptedDuprId: { type: String, required: true },
  succeeded: { type: Boolean, required: true },
  // Only meaningful when succeeded: false — what this specific attempt
  // discovered. Never written back to the issue's own conflictType/
  // implicatedUserIds above.
  conflictType: {
    type: String,
    enum: ['email_matches_dupr_conflict', 'dupr_matches_email_conflict', 'cross_match_conflict'],
  },
  conflictImplicatedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  attemptedAt: { type: Date, default: Date.now },
  attemptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const PlayerIdentityIssueSchema = new Schema<IPlayerIdentityIssue>({
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },

  // The row data exactly as originally submitted in the CSV — set once at
  // creation, NEVER touched again. This is what "Account X has this
  // issue" refers to, permanently, until the issue actually resolves.
  submittedName: { type: String },
  submittedEmail: { type: String, required: true },
  submittedDuprId: { type: String, required: true },
  submittedDateOfBirth: { type: String },
  submittedAge: { type: Number },

  // 1 or 2 existing accounts implicated AT CREATION — immutable, same
  // reasoning as submittedEmail/submittedDuprId above. Both get
  // identityUnresolved: true. A failed resolve attempt never adds or
  // removes accounts here, even if it discovers a different conflict —
  // that goes in `attempts` instead.
  implicatedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],

  conflictType: {
    type: String,
    enum: [
      'email_matches_dupr_conflict',  // row's email matches an existing account; row's DUPR ID doesn't match what's on it (missing or different)
      'dupr_matches_email_conflict',  // row's DUPR ID matches an existing account; row's email doesn't match what's on it
      'cross_match_conflict',         // row's email matches account A; row's DUPR ID matches a different account B
    ],
    required: true,
  },

  // [Attempt log] Every resolve attempt, success or failure — what was
  // tried and why it didn't work, if it didn't. Lets the admin see what's
  // already been tried without the original problem statement ever
  // drifting.
  attempts: { type: [AttemptSubSchema], default: [] },

  status: { type: String, enum: ['open', 'resolved'], default: 'open', required: true },

  // Free text — for whatever the admin needs to remember between opening
  // this and actually following up (e.g. "emailed player 8/20, waiting on reply").
  notes: { type: String },

  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedEmail: { type: String },
  resolvedDuprId: { type: String },
  // The account the row ended up resolving to — either a pre-existing
  // match, or a newly created account, depending on how it resolved.
  resolvedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

PlayerIdentityIssueSchema.index({ programId: 1, status: 1 });
PlayerIdentityIssueSchema.index({ implicatedUserIds: 1, status: 1 });

export default mongoose.models.PlayerIdentityIssue ||
  mongoose.model<IPlayerIdentityIssue>('PlayerIdentityIssue', PlayerIdentityIssueSchema);