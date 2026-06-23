import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import {
  submitMatchToDupr,
  submitMatchBatchToDupr,
} from '@/lib/services/dupr/duprMatches';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { Club } from '@/app/models/Club';
import { ClubUploadedMatch } from '@/app/models/ClubUploadedMatch';
import { DuprSubmissionStatus } from '@/app/types/databaseTypes';
import { verifyDuprEntitlement } from '@/lib/services/dupr/duprEntitlement';
import { logError } from '@/lib/sentry/logger';

// GET /api/club/matches?clubId=...&view=uploaded|synced&page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const view = searchParams.get('view') ?? 'uploaded';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    if (!clubId || !mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const club = await Club.findById(clubId).lean();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    if (!club.admins.some((a: any) => a.user.toString() === user.id.toString())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (view === 'uploaded') {
      const filter = { club: clubId, deletedAt: null };
      const [rows, total] = await Promise.all([
        ClubUploadedMatch.find(filter)
          .sort({ matchDate: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ClubUploadedMatch.countDocuments(filter),
      ]);
      return NextResponse.json({
        rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // TODO: view === 'synced' — join existing Match collection on duprMatchId
    return NextResponse.json({ rows: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err) {
    console.error('[GET /api/club/matches]', err);
    const errorId = logError(err, { endpoint: 'GET /api/club/matches' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/club/matches
// Strategy: write all local records as 'pending' first, then call DUPR.
// 1 match -> single create endpoint; 2+ -> batch endpoint (one round-trip).
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { clubId, eventId, matches } = body ?? {};

    if (!clubId || !mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }
    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: 'matches array required' }, { status: 400 });
    }

    const club = await Club.findById(clubId);
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    if (!club.admins.some((a: any) => a.user.toString() === user.id.toString())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify admin has DUPR entitlement
    const entitlement = await verifyDuprEntitlement(user.id);
    if (!entitlement.ok) {
      return NextResponse.json({ error: entitlement.error }, { status: entitlement.status });
    }

    // Verify admin has ORGANIZER or DIRECTOR role for this club
    const adminEntry = club.admins.find(
      (a: any) => a.user.toString() === user.id.toString()
    );
    if (!adminEntry || !['ORGANIZER', 'DIRECTOR'].includes(adminEntry.duprRole)) {
      return NextResponse.json(
        { error: 'You must be an Organizer or Director to submit matches for this club.' },
        { status: 403 }
      );
    }

    // Verify club has a DUPR club ID (required for matchSource: CLUB)
    if (!club.duprClubId) {
      return NextResponse.json(
        { error: 'This club is not linked to a DUPR club ID. Please reconnect the club.' },
        { status: 400 }
      );
    }

    // Fetch event name if eventId provided (DUPR requires an event name)
    let eventName: string | undefined;
    if (eventId && mongoose.isValidObjectId(eventId)) {
      const { ClubEvent } = await import('@/app/models/ClubEvent');
      const event = await ClubEvent.findById(eventId).select('name').lean();
      eventName = (event as { name?: string } | null)?.name;
    }

    // 1. Persist all matches locally as pending
    const docs = await ClubUploadedMatch.insertMany(
      matches.map((m) => ({
        club: clubId,
        event: eventId || undefined,
        createdByAdmin: user.id,
        matchDate: m.matchDate,
        teamA: m.teamA,
        teamB: m.teamB,
        location: m.location,
        notes: m.notes,
        duprSubmissionStatus: 'pending' as DuprSubmissionStatus,
      }))
    );

    // 2. Build DUPR inputs in the same order; identifier = local _id
    const inputs = docs.map((d) => ({
      matchDate: d.matchDate,
      teamA: d.teamA,
      teamB: d.teamB,
      location: d.location,
      clubDuprId: club.duprClubId,
      identifier: d._id.toString(),
      eventName,
    }));

    // 3. Call DUPR — single or batch
    const results: Array<{ ok: boolean; id: string; duprMatchId?: string; error?: string }> = [];

    if (inputs.length === 1) {
      try {
        const { matchId } = await submitMatchToDupr(inputs[0]);
        docs[0].duprMatchId = matchId;
        docs[0].duprSubmissionStatus = 'submitted';
        docs[0].submittedAt = new Date();
        await docs[0].save();
        results.push({ ok: true, id: docs[0]._id.toString(), duprMatchId: matchId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown DUPR error';
        docs[0].duprSubmissionStatus = 'failed';
        docs[0].duprSubmissionError = msg;
        await docs[0].save();
        results.push({ ok: false, id: docs[0]._id.toString(), error: msg });
      }
    } else {
      try {
        const batch = await submitMatchBatchToDupr(inputs);
        await Promise.all(
          batch.map(async (entry, i) => {
            const doc = docs[i];
            if (entry.ok) {
              doc.duprMatchId = entry.matchId;
              doc.duprSubmissionStatus = 'submitted';
              doc.submittedAt = new Date();
              await doc.save();
              results.push({ ok: true, id: doc._id.toString(), duprMatchId: entry.matchId });
            } else {
              doc.duprSubmissionStatus = 'failed';
              doc.duprSubmissionError = entry.error;
              await doc.save();
              results.push({ ok: false, id: doc._id.toString(), error: entry.error });
            }
          })
        );
      } catch (err) {
        // Whole batch request failed — mark every doc failed
        const msg = err instanceof Error ? err.message : 'Unknown DUPR error';
        await Promise.all(
          docs.map(async (doc) => {
            doc.duprSubmissionStatus = 'failed';
            doc.duprSubmissionError = msg;
            await doc.save();
            results.push({ ok: false, id: doc._id.toString(), error: msg });
          })
        );
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[POST /api/club/matches]', err);
    const errorId = logError(err, { endpoint: 'POST /api/club/matches' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}