// Destination: lib/programs/processPlayersUpload.ts

import { startSession } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import PlayersUploadPreview from '@/app/models/PlayersUploadPreview';
import PlayerIdentityIssue from '@/app/models/PlayerIdentityIssue';
import PlayerAgeVerification from '@/app/models/PlayerAgeVerification';
import User from '@/app/models/User';
import { reconcilePlayerIdentity } from './reconcilePlayerIdentity';
import { findOrCreatePlayerAccount } from './findOrCreatePlayerAccount';
import { logError } from '@/lib/sentry/logger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// [Identity reconciliation] Now runs each row inside a transaction — this
// file never had one before, but reconciliation does multiple related
// reads/writes per row (check identity, then create/backfill/flag+record-
// issue) that need to land together or not at all. Mirrors
// processMatchesUpload.ts's existing per-row transaction pattern.
export async function processPlayersUpload(previewId: string): Promise<void> {
  await connectToDatabase();

  const preview = await PlayersUploadPreview.findById(previewId);
  // Already completed and cleaned up (or never existed) — nothing to do.
  // Not an error condition; this is what a re-triggered/duplicate call
  // against an already-finished upload looks like.
  if (!preview) return;

  const eligibleRows = preview.rows.filter(
    (r) => !r.isUnder13 && r.validationErrors.length === 0 && r.duprId && r.name && r.email
  );

  for (const row of eligibleRows) {
    // Only true when we have positive confirmation that no Auth0 API call
    // was made this iteration. If the row's outcome is 'conflict' or a
    // clean 'match_existing', no Auth0 call happens at all. If it throws,
    // we can't know whether an Auth0 create request already succeeded
    // before some later step failed — so an error is treated as "might
    // have called Auth0" and still gets rate-limited, rather than risk
    // under-sleeping.
    let skippedApiCall = false;
    const session = await startSession();

    try {
      session.startTransaction();

      // [Eligibility check] Every row reaching this point is already
      // known 13+ (eligibleRows above filters on !r.isUnder13) —
      // regardless of what the reconciliation outcome below turns out to
      // be, this fact is worth recording permanently. Upsert +
      // $setOnInsert: idempotent across CSV re-uploads, and if this DUPR
      // ID was already confirmed by some other program's roster, that
      // earlier record wins — the underlying fact doesn't change, so
      // there's nothing to gain from overwriting it.
      await PlayerAgeVerification.updateOne(
        { duprId: row.duprId },
        {
          $setOnInsert: {
            duprId: row.duprId,
            dateOfBirth: row.dateOfBirth,
            ageAtSubmission: row.age,
            source: 'players_upload',
            programId: preview.programId,
            confirmedAt: new Date(),
          },
        },
        { upsert: true, session }
      );

      // [Identity reconciliation] Reconcile BEFORE ever touching Auth0 —
      // replaces the old dedup-by-DUPR-ID-only check. A conflict here
      // means we genuinely don't know which account (if any) this row
      // belongs to, so nothing gets created or modified for it; it's
      // skipped until a human resolves it via the identity-issue tracker.
      const reconciliation = await reconcilePlayerIdentity(row.email!, row.duprId!, session);

      if (reconciliation.outcome === 'conflict') {
        await User.updateMany(
          { _id: { $in: reconciliation.implicatedUserIds } },
          { $set: { identityUnresolved: true } },
          { session }
        );

        await PlayerIdentityIssue.create([{
          programId: preview.programId,
          submittedName: row.name,
          submittedEmail: row.email,
          submittedDuprId: row.duprId,
          submittedDateOfBirth: row.dateOfBirth,
          submittedAge: row.age,
          implicatedUserIds: reconciliation.implicatedUserIds,
          conflictType: reconciliation.conflictType,
          status: 'open',
        }], { session });

        skippedApiCall = true;
      } else if (reconciliation.outcome === 'match_existing') {
        if (reconciliation.backfillDuprId) {
          await User.updateOne(
            { _id: reconciliation.userId },
            { $set: { 'dupr.id': row.duprId } },
            { session }
          );
        }
        // Already exists and is consistent (or now backfilled) — no Auth0
        // call needed either way.
        skippedApiCall = true;
      } else {
        // create_new — the only outcome that needs a real Auth0 + User
        // record created. findOrCreatePlayerAccount's own internal
        // dedup-by-DUPR-ID check is now redundant (reconciliation already
        // confirmed neither field matches anything) but harmless to leave
        // in place as a defensive backstop.
        const result = await findOrCreatePlayerAccount({
          duprId: row.duprId!,
          name: row.name!,
          email: row.email!,
        }, { session });
        skippedApiCall = !result.created;
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      logError(err, {
        endpoint: 'processPlayersUpload',
        previewId,
        rowNumber: row.rowNumber,
        duprId: row.duprId,
      });
      // Continue regardless — one row's failure shouldn't stall the rest
      // of the file. Re-uploading the same CSV later safely retries
      // anything that failed, since account creation is idempotent per
      // DUPR ID, and reconciliation is idempotent by nature (re-running it
      // against unchanged data produces the same result).
    } finally {
      session.endSession();
    }

    if (!skippedApiCall) {
      await sleep(600);
    }
  }

  // Delete the preview once every eligible row has been attempted —
  // mirrors the Matches preview lifecycle (Section 10.7). Re-uploading the
  // same CSV is the retry path for anything that failed; this doc isn't
  // meant to be resumed in place.
  await PlayersUploadPreview.deleteOne({ _id: previewId });
}