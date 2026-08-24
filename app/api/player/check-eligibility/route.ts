// Destination: app/api/player/check-eligibility/route.ts
//
// [Eligibility check — Step 3] Called from a logged-in player's own
// action (e.g. a "Check eligibility" button on /play). No body needed —
// uses the caller's own connected/verified DUPR ID, not an arbitrary one.
//
// Finds matches already processed BEFORE this player had a resolvable
// account — via team1DuprIds/team2DuprIds, which are populated regardless
// of whether a slot resolved at original processing time (see Match.ts,
// Step 1) — and catches them up: added to the match, achievement/reward
// pipeline run scoped to just them, processedUsers updated so this can
// never double-fire. Mirrors the existing DUPR-sync merge-into-existing-
// match pattern (the personal sync SSE route) — same mechanism, new
// trigger.
//
// Age check runs ONCE per call, not once per match — the answer doesn't
// depend on which match is being looked at, only on the DUPR ID itself.
//
// [Logging] Every step logs with a [CheckEligibility] prefix so a full
// run can be traced end to end during testing.

import { NextRequest, NextResponse } from 'next/server';
import { startSession } from 'mongoose';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Match from '@/app/models/Match';
import { checkPlayerAgeEligibility } from '@/lib/programs/checkPlayerAgeEligibility';
import { updateUserAndAchievements } from '@/utils/achievementFunctions/updateUserAndAchievements';
import { logError } from '@/lib/sentry/logger';

// Matches decided value: 6 months since the match's own date, not 6
// months of wall-clock elapsed since some other reference point.
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export async function POST(req: NextRequest) {
  console.log('[CheckEligibility] ── New request ──');

  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    console.log('[CheckEligibility] No authorized user — 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log(`[CheckEligibility] Authorized user id: ${authorizedUser.id}`);

  await connectToDatabase();

  const user = await User.findById(authorizedUser.id);
  if (!user) {
    console.log('[CheckEligibility] No User document found for this id — 404');
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  console.log(`[CheckEligibility] User found: ${user.name} (${user._id.toString()})`);

  const duprId = user.dupr?.id;
  if (!duprId) {
    console.log('[CheckEligibility] No DUPR ID connected on this account — 400');
    return NextResponse.json({ error: 'Connect your DUPR account first.' }, { status: 400 });
  }
  console.log(`[CheckEligibility] DUPR ID: ${duprId}`);

  // [Age review] If this account is already flagged pending manual
  // review, block entirely — before any match-scanning happens, not just
  // before crediting. Same generic "blocked" shape as a live age-check
  // failure, so this looks identical from the player's side either way —
  // never confirms or denies a specific age determination.
  if (user.pendingAgeReview) {
    console.log(`[CheckEligibility] User ${user._id} has pendingAgeReview set — blocking without processing.`);
    return NextResponse.json({
      matchesFound: 0,
      matchesProcessed: 0,
      blocked: true,
      reason: 'pending_review',
    });
  }

  const cutoff = new Date(Date.now() - SIX_MONTHS_MS);
  console.log(`[CheckEligibility] Lookback cutoff (6 months): ${cutoff.toISOString()}`);

  // Matches containing this DUPR ID in either team, that this user hasn't
  // already been credited for, within the lookback window.
  const candidateMatches = await Match.find({
    $or: [{ team1DuprIds: duprId }, { team2DuprIds: duprId }],
    processedUsers: { $ne: user._id },
    matchDate: { $gte: cutoff },
  });

  console.log(
    `[CheckEligibility] Candidate matches found: ${candidateMatches.length}` +
    (candidateMatches.length > 0
      ? ` — sourceMatchIds: ${candidateMatches.map((m) => m.sourceMatchId ?? m._id.toString()).join(', ')}`
      : '')
  );

  if (candidateMatches.length === 0) {
    console.log('[CheckEligibility] Nothing to process — returning early.');
    return NextResponse.json({ matchesFound: 0, matchesProcessed: 0 });
  }

  // Age check — once, up front. Never shortcuts on account existence
  // (see checkPlayerAgeEligibility.ts for why) — checks the registry,
  // falls back to the DUPR API lookup, caches the result either way.
  console.log('[CheckEligibility] Running age eligibility check…');
  const ageSession = await startSession();
  let ageResult;
  try {
    ageSession.startTransaction();
    ageResult = await checkPlayerAgeEligibility(duprId, user._id.toString(), ageSession);
    await ageSession.commitTransaction();
  } catch (err) {
    await ageSession.abortTransaction();
    console.log('[CheckEligibility] Age check threw — aborting, 500. See Sentry for details.');
    logError(err, { endpoint: 'POST /api/player/check-eligibility', task: 'age check', duprId });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  } finally {
    ageSession.endSession();
  }

  console.log(`[CheckEligibility] Age check result: ${JSON.stringify(ageResult)}`);

  if (!ageResult.eligible) {
    console.log(`[CheckEligibility] BLOCKED — reason: ${ageResult.reason}. Flagging account and returning without processing.`);
    // [Bug fix] This is a SEPARATE age check from the one in
    // PATCH /api/user (Connect DUPR) — it existed before that wiring was
    // added, and until now only affected THIS response, transiently.
    // Whichever endpoint discovers an age problem first needs to persist
    // it the same way, or an account that was only ever checked here
    // (never through a real Connect DUPR flow with the age-check code)
    // would silently never appear in Age Review, and would re-run the
    // live DUPR API call on every single click forever, since 'unknown'/
    // confirmed_under_13 are deliberately never cached in the registry.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          pendingAgeReview: true,
          pendingAgeReviewReason: ageResult.reason,
          pendingAgeReviewAt: new Date(),
        },
      }
    );
    return NextResponse.json({
      matchesFound: candidateMatches.length,
      matchesProcessed: 0,
      blocked: true,
      reason: ageResult.reason,
    });
  }

  console.log(`[CheckEligibility] Eligible (source: ${ageResult.source}) — proceeding to process ${candidateMatches.length} match(es).`);

  let processedCount = 0;

  // One transaction per match — a failure on one shouldn't affect any
  // other, same reasoning as processMatchesUpload.ts's per-row isolation.
  for (const match of candidateMatches) {
    const matchLabel = match.sourceMatchId ?? match._id.toString();
    console.log(`[CheckEligibility] ── Processing match ${matchLabel} ──`);

    const session = await startSession();
    try {
      session.startTransaction();

      const isOnTeam1 = (match.team1DuprIds ?? []).includes(duprId);
      const myTeam = isOnTeam1 ? match.team1 : match.team2;
      const otherTeamScore = isOnTeam1 ? match.team2.score : match.team1.score;
      const iWon = (myTeam.score ?? 0) > (otherTeamScore ?? 0);

      console.log(
        `[CheckEligibility] Match ${matchLabel} — on team: ${isOnTeam1 ? 'team1' : 'team2'}, ` +
        `my score: ${myTeam.score}, other score: ${otherTeamScore}, won: ${iWon}`
      );

      const alreadyOnTeam = myTeam.players.some(
        (p: any) => p.toString() === user._id.toString()
      );
      if (!alreadyOnTeam) {
        myTeam.players.push(user._id);
        console.log(`[CheckEligibility] Match ${matchLabel} — added user to team.players`);
      } else {
        console.log(`[CheckEligibility] Match ${matchLabel} — already in team.players, skipping add`);
      }

      const alreadyAWinner = match.winners.some(
        (w: any) => w.toString() === user._id.toString()
      );
      if (iWon && !alreadyAWinner) {
        match.winners.push(user._id);
        console.log(`[CheckEligibility] Match ${matchLabel} — added user to winners`);
      }

      await match.save({ session });
      console.log(`[CheckEligibility] Match ${matchLabel} — match doc saved with updated players/winners`);

      // This route only ever resolves ONE player per call — the person who
      // clicked the button. Their teammate, and the whole opposing team,
      // are very likely still unresolved. Same fix as
      // processMatchesUpload.ts: every slot needs SOME entry — a real ID
      // or 'UNKNOWN' — so the array always hits exactly expectedTeamSize.
      // Building straight from match.teamX.players (as this used to)
      // produces a short array whenever anyone else on the team hasn't
      // been caught up yet, which is exactly what threw here.
      const expectedTeamSize = match.matchType === 'singles' ? 1 : 2;
      const padTeamIds = (players: any[]): string[] => {
        const ids = players.map((p: any) => p.toString());
        while (ids.length < expectedTeamSize) ids.push('UNKNOWN');
        return ids.slice(0, expectedTeamSize); // safety: never exceed expected size either
      };

      const team1Ids = padTeamIds(match.team1.players);
      const team2Ids = padTeamIds(match.team2.players);
      const winnerIds = match.winners.map((w: any) => w.toString());
      console.log(
        `[CheckEligibility] Match ${matchLabel} — team1Ids: [${team1Ids.join(', ')}], ` +
        `team2Ids: [${team2Ids.join(', ')}] (expectedTeamSize: ${expectedTeamSize})`
      );

      console.log(
        `[CheckEligibility] Match ${matchLabel} — calling updateUserAndAchievements ` +
        `(targetUserIds: [${user._id.toString()}], countAsWin: true)`
      );

      await updateUserAndAchievements(
        {
          team1Ids,
          team2Ids,
          winners: winnerIds,
          location: 'global', // unused when isGlobalContext: true, but the shared type requires it
          matchId: match.matchId,
          team1Score: match.team1.score,
          team2Score: match.team2.score,
          matchDate: match.matchDate,
          isHistorical: true,
          isGlobalContext: true,
          triggeringEvent: match.division,
          matchType: match.matchType,
          excludeAchievementKeySubstrings: ['win-streak'],
          // Same reasoning as processMatchesUpload.ts — every program-
          // sourced match is its own independent win/loss event.
          countAsWin: true,
          // Scoped to just this player — mirrors the personal DUPR-sync
          // routes' use of the same option to avoid re-processing
          // teammates/opponents who were already credited at original
          // processing time.
          targetUserIds: [user._id.toString()],
        },
        { session }
      );

      console.log(`[CheckEligibility] Match ${matchLabel} — updateUserAndAchievements completed`);

      match.processedUsers.push(user._id);
      await match.save({ session });
      console.log(`[CheckEligibility] Match ${matchLabel} — added to processedUsers, saved`);

      await session.commitTransaction();
      console.log(`[CheckEligibility] Match ${matchLabel} — transaction committed ✓`);
      processedCount++;
    } catch (err) {
      await session.abortTransaction();
      console.log(`[CheckEligibility] Match ${matchLabel} — FAILED, transaction aborted. See Sentry for details.`);
      logError(err, {
        endpoint: 'POST /api/player/check-eligibility',
        task: 'catch-up processing',
        matchId: match._id.toString(),
        duprId,
      });
      // Continue to the next match regardless — one match's failure
      // shouldn't block the rest. Re-clicking "check eligibility" later
      // safely retries anything that failed, since this match still
      // won't have this user in processedUsers.
    } finally {
      session.endSession();
    }
  }

  console.log(
    `[CheckEligibility] ── Done. Found: ${candidateMatches.length}, Processed: ${processedCount} ──`
  );

  return NextResponse.json({
    matchesFound: candidateMatches.length,
    matchesProcessed: processedCount,
  });
}