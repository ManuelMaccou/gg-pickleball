import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ClubEvent } from '@/app/models/ClubEvent';
import { Club } from '@/app/models/Club';
import { ClubUploadedMatch } from '@/app/models/ClubUploadedMatch';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import { EventRegistration } from '@/app/models/EventRegistration';

async function loadAndAuthorize(eventId: string, userId: string) {
  if (!mongoose.isValidObjectId(eventId)) return { error: 'Invalid eventId', status: 400 as const };
  const event = await ClubEvent.findById(eventId);
  if (!event) return { error: 'Event not found', status: 404 as const };
  const club = await Club.findById(event.club);
  if (!club) return { error: 'Club not found', status: 404 as const };
  if (!club.admins.some((a: any) => a.user.toString() === userId)) {
    return { error: 'Forbidden', status: 403 as const };
  }
  
  return { event, club };
}

// GET /api/club/events/[eventId] — event detail + its uploaded matches
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const loaded = await loadAndAuthorize(eventId, user.id.toString());
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { event } = loaded;

    // Matches — only past events have uploaded matches.
    const matches = event.eventType === 'past'
      ? await ClubUploadedMatch.find({ event: event._id, deletedAt: null })
          .sort({ matchDate: -1, createdAt: -1 })
          .lean()
      : [];

    // Registrations — only upcoming events have registrants.
    const registrations = event.eventType === 'upcoming'
      ? await EventRegistration.find({ event: event._id, status: 'registered' })
          .sort({ registeredAt: 1 })
          .lean()
      : [];

    return NextResponse.json({ event, matches, registrations });
  } catch (err) {
    console.error('[GET /api/club/events/[eventId]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/club/events/[eventId] — update event name/date/notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const loaded = await loadAndAuthorize(eventId, user.id.toString());
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { event } = loaded;

    const body = await req.json();
    const { name, eventDate, notes } = body ?? {};

    if (name !== undefined) event.name = name;
    if (eventDate !== undefined) event.eventDate = eventDate;
    if (notes !== undefined) event.notes = notes;
    await event.save();

    return NextResponse.json({ event });
  } catch (err) {
    console.error('[PATCH /api/club/events/[eventId]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/club/events/[eventId] — deletes event and unlinks its matches
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const loaded = await loadAndAuthorize(eventId, user.id.toString());
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { event } = loaded;

    // Unlink matches from this event (don't delete the matches themselves)
    await ClubUploadedMatch.updateMany(
      { event: event._id },
      { $unset: { event: '' } }
    );

    await ClubEvent.findByIdAndDelete(event._id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/club/events/[eventId]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}