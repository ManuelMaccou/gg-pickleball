// GET /api/events/upcoming
//
// Returns upcoming events across all clubs, ordered by eventDate ascending.
// Auth is optional — unauthenticated users see the feed without registration status.
// Authenticated users get isRegistered per event.
//
// Published filter:
//   - published: true  → included in the feed for everyone
//   - published: false → hidden from the feed UNLESS the user is registered,
//     in which case it's included with cancelled: true and clubOwnerEmail so
//     the player can contact the organiser.

import { NextRequest, NextResponse } from 'next/server';
import { ClubEvent } from '@/app/models/ClubEvent';
import { EventRegistration } from '@/app/models/EventRegistration';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Show events that started within the last hour — they're still relevant
    // while in progress. Events disappear from the feed 1 hour after start.
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // ── Fetch published events ─────────────────────────────────────────────
    const publishedFilter = {
      eventType: 'upcoming',
      eventDate: { $gte: oneHourAgo },
      published: { $ne: false }, // treat missing field as published (migration safety)
    };

    const [publishedEvents, publishedTotal] = await Promise.all([
      ClubEvent.find(publishedFilter)
        .sort({ eventDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClubEvent.countDocuments(publishedFilter),
    ]);

    // ── For authenticated non-guest users, also fetch cancelled events ─────
    // A cancelled event is one where published: false but the user is registered.
    // These always appear regardless of pagination since there are typically few.
    let cancelledEvents: any[] = [];
    let registeredEventIds = new Set<string>();

    if (user && !user.isGuest) {
      const publishedEventIds = publishedEvents.map((e) => e._id);

      // All registrations for this user across published events
      const [publishedRegistrations, cancelledRegistrations] = await Promise.all([
        EventRegistration.find({
          event: { $in: publishedEventIds },
          user: user.id,
          status: 'registered',
        })
          .select('event')
          .lean(),

        // Find any unpublished events the user is registered for
        EventRegistration.find({
          user: user.id,
          status: 'registered',
        })
          .select('event')
          .lean(),
      ]);

      registeredEventIds = new Set(publishedRegistrations.map((r) => r.event.toString()));

      // From all registrations, find any that are for unpublished events
      const allRegisteredEventIds = cancelledRegistrations.map((r) => r.event);
      const unpublishedRegisteredEvents = await ClubEvent.find({
        _id: { $in: allRegisteredEventIds },
        eventType: 'upcoming',
        published: false,
      }).lean();

      cancelledEvents = unpublishedRegisteredEvents;
    }

    // ── Fetch club names and owner emails ──────────────────────────────────
    const allEvents = [...publishedEvents, ...cancelledEvents];
    const clubIds = [...new Set(allEvents.map((e) => e.club.toString()))];

    const clubs = await mongoose.connection.collection('clubs')
      .find({ _id: { $in: clubIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ name: 1, admins: 1 })
      .toArray();

    // Build club name map and admin user ID map
    const clubNameMap = new Map<string, string>();
    const clubFirstAdminMap = new Map<string, mongoose.Types.ObjectId>();

    for (const club of clubs) {
      clubNameMap.set(club._id.toString(), club.name);
      if (club.admins?.length > 0) {
        clubFirstAdminMap.set(club._id.toString(), club.admins[0].user);
      }
    }

    const allClubIds = [...new Set(allEvents.map((e) => e.club.toString()))];
    const adminUserIds = allClubIds
      .map((id) => clubFirstAdminMap.get(id))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const adminUsers = adminUserIds.length > 0
      ? await mongoose.connection.collection('users')
          .find({ _id: { $in: adminUserIds } })
          .project({ email: 1 })
          .toArray()
      : [];

    // Map adminUserId → email
    const adminEmailMap = new Map<string, string>();
    for (const u of adminUsers) {
      adminEmailMap.set(u._id.toString(), u.email);
    }

    // Map clubId → owner email (via first admin)
    const clubOwnerEmailMap = new Map<string, string>();
    for (const clubId of allClubIds) {
      const adminUserId = clubFirstAdminMap.get(clubId);
      if (adminUserId) {
        const email = adminEmailMap.get(adminUserId.toString());
        if (email) clubOwnerEmailMap.set(clubId, email);
      }
    }

    // ── Assemble response ──────────────────────────────────────────────────
    const publishedEventsWithStatus = publishedEvents.map((e) => ({
      ...e,
      cancelled: false,
      isRegistered: registeredEventIds.has(e._id.toString()),
      clubOwnerEmail: clubOwnerEmailMap.get(e.club.toString()) ?? null,
      club: { _id: e.club.toString(), name: clubNameMap.get(e.club.toString()) ?? '' },
    }));

    const cancelledEventsWithStatus = cancelledEvents.map((e) => ({
      ...e,
      cancelled: true,
      isRegistered: true, // by definition — we only fetch cancelled events the user is registered for
      clubOwnerEmail: clubOwnerEmailMap.get(e.club.toString()) ?? null,
      club: { _id: e.club.toString(), name: clubNameMap.get(e.club.toString()) ?? '' },
    }));

    // Cancelled events go at the top so registered players see them immediately
    const allEventsResponse = [...cancelledEventsWithStatus, ...publishedEventsWithStatus];

    return NextResponse.json({
      events: allEventsResponse,
      pagination: {
        page,
        limit,
        total: publishedTotal,
        totalPages: Math.ceil(publishedTotal / limit),
      },
    });
  } catch (err) {
    console.error('[GET /api/events/upcoming]', err);
    const errorId = logError(err, { endpoint: 'GET /api/events/upcoming' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}