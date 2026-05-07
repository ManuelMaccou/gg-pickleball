// GET /api/events/upcoming
//
// Returns all upcoming events across all clubs, ordered by eventDate ascending.
// Auth is optional — unauthenticated users see the feed without registration status.
// Authenticated users get isRegistered per event so the UI can render the
// correct button state without a second round-trip.

import { NextRequest, NextResponse } from 'next/server';
import { ClubEvent } from '@/app/models/ClubEvent';
import { EventRegistration } from '@/app/models/EventRegistration';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    // Auth is optional — unauthenticated users can see the feed,
    // they just won't have registration status per event.
    const user = await getAuthorizedUser(req);

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const now = new Date();

    const [events, total] = await Promise.all([
      ClubEvent.find({ eventType: 'upcoming', eventDate: { $gte: now } })
        .sort({ eventDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClubEvent.countDocuments({ eventType: 'upcoming', eventDate: { $gte: now } }),
    ]);

    // Only look up registration status if there's a logged-in non-guest user.
    let registeredEventIds = new Set<string>();
    if (user && !user.isGuest) {
      const eventIds = events.map((e) => e._id);
      const userRegistrations = await EventRegistration.find({
        event: { $in: eventIds },
        user: user.id,
        status: 'registered',
      })
        .select('event')
        .lean();
      registeredEventIds = new Set(userRegistrations.map((r) => r.event.toString()));
    }

    // Fetch club names manually to avoid populate requiring Club schema registration.
    const clubIds = [...new Set(events.map((e) => e.club.toString()))];
    const clubs = await mongoose.connection.collection('clubs')
      .find({ _id: { $in: clubIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ name: 1 })
      .toArray();

    const clubNameMap = new Map(clubs.map((c) => [c._id.toString(), c.name]));

    const eventsWithStatus = events.map((e) => ({
      ...e,
      isRegistered: registeredEventIds.has(e._id.toString()),
      club: { _id: e.club.toString(), name: clubNameMap.get(e.club.toString()) ?? '' },
    }));

    return NextResponse.json({
      events: eventsWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[GET /api/events/upcoming]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}