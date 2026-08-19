// Destination: lib/programs/processMatchesUpload.ts

import { startSession } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import MatchesUploadPreview from '@/app/models/MatchesUploadPreview';
import Match from '@/app/models/Match';
import User from '@/app/models/User';
import { createMatch } from '@/lib/services/matchBulkUpload/matchService';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { logError } from '@/lib/sentry/logger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// [Program pivot] The detached background loop kicked off (not awaited) by
// the confirm route. One MongoDB transaction per row/game (Requirements
// doc, Section 10.6) — unlike Players processing, this genuinely needs the
// transaction: each row is a multi-write (Match creation + stats +
// achievements + rewards), and a partial failure must not leave any of
// that half-committed.
//
// [Program pivot] No DataSource lookup — dataSourceId was removed from
// Match, RewardCode, and updateUserAndAchievements entirely (rewards are
// universal, DUPR-source tracking isn't needed). Nothing here needs to
// know or care which "source" it's processing for anymore.
//
// No merge-with-existing-Match branch, unlike the personal DUPR-sync
// routes this otherwise mirrors — that branch exists there because
// different players independently sync the same real-world match over
// time. Program matches don't have that problem: every row is resolved
// and processed atomically in one pass. A row's sourceMatchId either
// already has a committed Match (skip entirely) or it doesn't (create
// fresh, process fully) — no partial state in between.
export async function processMatchesUpload(previewId: string): Promise<void> {
  await connectToDatabase();

  const preview = await MatchesUploadPreview.findById(previewId);
  // Already completed and cleaned up (or never existed) — nothing to do.
  if (!preview) return;

  const eligibleRows = preview.rows.filter((r) => r.validationErrors.length === 0);

  for (const row of eligibleRows) {
    // Idempotency check — skip if this row already succeeded on a prior
    // (possibly interrupted) run. This is what makes re-confirming or
    // re-uploading the same file safe.
    const existingMatch = await Match.findOne({ sourceMatchId: row.sourceMatchId });
    if (existingMatch) continue;

    const session = await startSession();
    try {
      session.startTransaction();

      // Resolve every populated DUPR ID slot in one query.
      const duprIdsInRow = [
        row.team1Player1DuprId,
        row.team1Player2DuprId,
        row.team2Player1DuprId,
        row.team2Player2DuprId,
      ].filter((id): id is string => !!id);

      const users = await User.find({ 'dupr.id': { $in: duprIdsInRow } }).session(session);
      const userByDuprId = new Map(users.map((u) => [u.dupr?.id, u]));

      // [Identity reconciliation] Any DUPR ID that doesn't resolve is
      // treated as an under-13 participant (or someone never added via the
      // Players upload) and silently skipped — 'UNKNOWN' placeholder,
      // matching the existing convention used by the personal DUPR-sync
      // routes. Accounts flagged identityUnresolved get the SAME
      // treatment even though they technically matched: an unresolved
      // email/DUPR conflict means we don't actually know this is the
      // right account, so no match reference, no rewards, until a human
      // resolves it via the identity-issue tracker.
      const resolve = (duprId?: string): string => {
        if (!duprId) return 'UNKNOWN';
        const user = userByDuprId.get(duprId);
        if (!user || user.identityUnresolved) return 'UNKNOWN';
        return user._id.toString();
      };

      // Array LENGTH must equal matchType's expected team size exactly —
      // singles is a single-element array, not a 2-element array padded
      // with a placeholder. This is what the shared
      // updateUserAndAchievements team-size check validates against.
      const team1Ids =
        row.matchType === 'doubles'
          ? [resolve(row.team1Player1DuprId), resolve(row.team1Player2DuprId)]
          : [resolve(row.team1Player1DuprId)];
      const team2Ids =
        row.matchType === 'doubles'
          ? [resolve(row.team2Player1DuprId), resolve(row.team2Player2DuprId)]
          : [resolve(row.team2Player1DuprId)];

      // Safe non-null assertions — this row passed validateMatchRow with
      // zero validationErrors, which guarantees these are set (including
      // the tie-score check, so team1Score !== team2Score is guaranteed
      // too).
      const team1Score = row.team1Score!;
      const team2Score = row.team2Score!;
      const team1Won = team1Score > team2Score;
      const winnerIds = team1Won ? team1Ids : team2Ids;

      const resolvedIds = [...team1Ids, ...team2Ids].filter((id) => id !== 'UNKNOWN');

      // [Eligibility check] Raw DUPR IDs per team, independent of whether
      // each slot resolved — this is what survives even for an 'UNKNOWN'
      // slot, so someone who joins the platform later can still find this
      // match by DUPR ID lookup. Not positionally tied to team1Ids/
      // team2Ids; just every non-empty submitted ID for that team.
      const team1DuprIds = [row.team1Player1DuprId, row.team1Player2DuprId].filter(
        (id): id is string => !!id
      );
      const team2DuprIds = [row.team2Player1DuprId, row.team2Player2DuprId].filter(
        (id): id is string => !!id
      );

      const matchDoc = await createMatch(
        {
          matchDate: new Date(row.matchDate!),
          location: null,
          team1Ids,
          team1Score,
          team2Ids,
          team2Score,
          winners: winnerIds,
          sourceMatchId: row.sourceMatchId,
          matchType: row.matchType,
          programId: preview.programId.toString(),
          division: row.division,
          team1DuprIds,
          team2DuprIds,
          processedUsers: resolvedIds,
          isGlobalContext: true,
        },
        { session }
      );

      await updateUserAndAchievements(
        {
          team1Ids,
          team2Ids,
          winners: winnerIds,
          location: 'global',
          matchId: matchDoc.matchId,
          team1Score,
          team2Score,
          matchDate: new Date(row.matchDate!),
          isHistorical: true,
          isGlobalContext: true,
          triggeringEvent: row.division,
          matchType: row.matchType,
          excludeAchievementKeySubstrings: ['win-streak'],
          // Every CSV row is its own independent game/win-loss event (no
          // DUPR-style "which game in this match actually counts" concept
          // for program data) — so this is unconditionally true, not a
          // per-row computed value. Missing this was the actual bug: wins/
          // losses in processGlobalMatch are gated on countAsWin, pointsWon
          // isn't, which is exactly why points were tallying but wins
          // weren't.
          countAsWin: true,
        },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      logError(err, {
        endpoint: 'processMatchesUpload',
        previewId,
        rowNumber: row.rowNumber,
        sourceMatchId: row.sourceMatchId,
      });
      // Continue regardless — one row's failure shouldn't stall the rest
      // of the file. Re-confirming or re-uploading safely retries anything
      // that failed, since Match creation is idempotent per sourceMatchId.
    } finally {
      session.endSession();
    }

    // Shopify discount-code API rate-limit safety — reuses the existing,
    // already-tuned retroactive-reward-sweep route's pause rather than
    // inventing a new number for the same underlying API. Applied after
    // every row regardless of whether a reward was actually issued, same
    // conservative choice that route already makes.
    await sleep(50);
  }

  await MatchesUploadPreview.deleteOne({ _id: previewId });
}