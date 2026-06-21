import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ClubEvent } from '@/app/models/ClubEvent';
import { Club } from '@/app/models/Club';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import { logError } from '@/lib/sentry/logger';

// GET /api/club/events?clubId=...&page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    if (!clubId || !mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    const club = await Club.findById(clubId).lean();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    if (!club.admins.some( (a: any) => a.user.toString() === user.id.toString())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filter = { club: clubId };
    const [events, total] = await Promise.all([
      ClubEvent.find(filter)
        .sort({ eventDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClubEvent.countDocuments(filter),
    ]);

    return NextResponse.json({
      events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[GET /api/club/events]', err);
    const errorId = logError(err, { endpoint: 'GET /api/club/events' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/club/events
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const body = await req.json();
    const { clubId, name, eventDate, eventType, notes, accessLevel, location, description } = body ?? {};

    // ── Validate required fields ──────────────────────────────────────────────
    if (!clubId || !mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }
    if (!name || !eventDate) {
      return NextResponse.json({ error: 'name and eventDate required' }, { status: 400 });
    }
    if (!eventType || !['past', 'upcoming'].includes(eventType)) {
      return NextResponse.json({ error: 'eventType must be "past" or "upcoming"' }, { status: 400 });
    }

    // ── Upcoming-specific validation ──────────────────────────────────────────
    if (eventType === 'upcoming') {
      const todayUTC = new Date().toISOString().slice(0, 10); // always "2026-04-30" in UTC
      if (eventDate < todayUTC) {
        return NextResponse.json(
          { error: 'Upcoming events must be scheduled for today or a future date.' },
          { status: 400 }
        );
      }

      if (accessLevel && !['open', 'dupr_plus'].includes(accessLevel)) {
        return NextResponse.json(
          { error: 'accessLevel must be "open" or "dupr_plus"' },
          { status: 400 }
        );
      }
    }

    // Past events cannot be DUPR+ gated — registration is already closed.
    if (eventType === 'past' && accessLevel === 'dupr_plus') {
      return NextResponse.json(
        { error: 'Past events cannot be restricted to DUPR+ members.' },
        { status: 400 }
      );
    }

    // ── Club auth ─────────────────────────────────────────────────────────────
    const club = await Club.findById(clubId).lean();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    if (!club.admins.some((a: any) => a.user.toString() === user.id.toString())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Create ────────────────────────────────────────────────────────────────
    const event = await ClubEvent.create({
      club: clubId,
      createdByAdmin: user.id,
      name,
      eventDate,
      eventType,
      notes: notes || undefined,
      // Only persist upcoming-specific fields when relevant.
      ...(eventType === 'upcoming' && {
        accessLevel: accessLevel ?? 'open',
        location: location || undefined,
        description: description || undefined,
      }),
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/club/events]', err);
    const errorId = logError(err, { endpoint: 'POST /api/club/events' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}