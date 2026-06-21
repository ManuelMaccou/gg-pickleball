// /api/events/[eventId]/register
//
// POST — register the logged-in user for an upcoming event.
// GET  — (admin only) list all registrants for an event.

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ClubEvent } from '@/app/models/ClubEvent';
import { EventRegistration } from '@/app/models/EventRegistration';
import { Club } from '@/app/models/Club';
import User from '@/app/models/User';
import { verifyDuprEntitlement } from '@/lib/services/dupr/duprEntitlement';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import { logError } from '@/lib/sentry/logger';

// ── POST /api/events/[eventId]/register ───────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const resolvedUser = await getAuthorizedUser(req);
    if (!resolvedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (resolvedUser.isGuest) {
      return NextResponse.json({ error: 'Guests cannot register for events.' }, { status: 403 });
    }

    await connectToDatabase();

    if (!mongoose.isValidObjectId(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID.' }, { status: 400 });
    }

    // ── Load the event ────────────────────────────────────────────────────────
    const event = await ClubEvent.findById(eventId).lean();
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });

    if (event.eventType !== 'upcoming') {
      return NextResponse.json(
        { error: 'Registration is only available for upcoming events.' },
        { status: 400 }
      );
    }

    if (event.eventDate <= new Date()) {
      return NextResponse.json(
        { error: 'Registration is closed — this event has already started.' },
        { status: 400 }
      );
    }

    // ── Load the user doc for DUPR fields + snapshot data ────────────────────
    // getAuthorizedUser returns a lightweight session object; we need the full
    // user doc to read dupr.id and snapshot name/email at registration time.
    const userDoc = await User.findById(resolvedUser.id)
      .select('name email dupr')
      .lean() as {
        name: string;
        email?: string;
        dupr?: { id?: string; userToken?: string; };
      } | null;

    if (!userDoc) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!userDoc.dupr?.userToken) {
      return NextResponse.json(
        { error: 'You must connect your DUPR account before registering for events.' },
        { status: 403 }
      );
    }

    if (!userDoc.dupr?.id) {
      return NextResponse.json(
        { error: 'Your DUPR ID could not be found. Please reconnect your DUPR account.' },
        { status: 403 }
      );
    }

    // ── Entitlement checks ────────────────────────────────────────────────────
    // All registrants need at least BASIC_L1.
    const basicCheck = await verifyDuprEntitlement(resolvedUser.id, 'BASIC_L1');
    if (!basicCheck.ok) {
      return NextResponse.json({ error: basicCheck.error }, { status: basicCheck.status });
    }

    // DUPR+ events require PREMIUM_L1. Run synchronously — don't rely solely
    // on the cached value so a lapsed subscription can't slip through.
    let duprPlusVerified = false;
    if (event.accessLevel === 'dupr_plus') {
      const premiumCheck = await verifyDuprEntitlement(resolvedUser.id, 'PREMIUM_L1');
      if (!premiumCheck.ok) {
        return NextResponse.json({ error: premiumCheck.error }, { status: premiumCheck.status });
      }
      duprPlusVerified = true;
    }

    // ── Create registration atomically with counter increment ─────────────────
    // Use a session so the registration insert and counter increment are
    // either both written or both rolled back.
    const session = await mongoose.startSession();
    try {
      let registration: InstanceType<typeof EventRegistration> | null = null;

      await session.withTransaction(async () => {
        // Check for duplicate registration inside the transaction so the unique
        // index and this check are evaluated under the same session.
        const existing = await EventRegistration.findOne(
          { event: eventId, user: resolvedUser.id },
          null,
          { session }
        );
        if (existing) {
          if (existing.status === 'registered') {
            throw Object.assign(new Error('You are already registered for this event.'), {
              status: 409,
            });
          }
          // If we add cancellation later: a cancelled registration would be
          // re-activated here rather than inserting a duplicate.
        }

        [registration] = await EventRegistration.create(
          [
            {
              event: eventId,
              user: resolvedUser.id,
              // Snapshot from the DB user doc, not the session object.
              name: userDoc.name,
              email: userDoc.email,
              duprId: userDoc.dupr!.id!,
              duprPlusVerifiedAtRegistration: duprPlusVerified,
              status: 'registered',
              registeredAt: new Date(),
            },
          ],
          { session }
        );

        await ClubEvent.findByIdAndUpdate(
          eventId,
          { $inc: { registrationCount: 1 } },
          { session }
        );
      });

      return NextResponse.json({ registration }, { status: 201 });
    } catch (err: any) {
      // Re-throw errors that have an explicit HTTP status (e.g. 409 duplicate).
      if (err?.status) {
        const errorId = logError(err, { endpoint: 'UNKNOWN /api/events/[eventId]/register' });
        return NextResponse.json({ errorId, error: err.message }, { status: err.status });
      }
      // Unique index violation — race condition where two requests slipped
      // past the duplicate check simultaneously.
      if (err?.code === 11000) {
        const errorId = logError(err, {
          endpoint: 'POST /api/events/[eventId]/register',
          task: 'Duplicate event registration',
        });
        return NextResponse.json(
          { errorId, error: 'You are already registered for this event.' },
          { status: 409 }
        );
      }
      throw err;
    } finally {
      await session.endSession();
    }
  } catch (err) {
    console.error('[POST /api/events/[eventId]/register]', err);
    const errorId = logError(err, { endpoint: 'UNKNOWN /api/events/[eventId]/register' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}

// ── GET /api/events/[eventId]/registrations ───────────────────────────────────
// Admin-only. Returns the full registrant list for an event.
// Reuses the club admin check via the event's club reference.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const resolvedUser = await getAuthorizedUser(req);
    if (!resolvedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    if (!mongoose.isValidObjectId(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID.' }, { status: 400 });
    }

    const event = await ClubEvent.findById(eventId).lean();
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });

    // Verify the requesting user is an admin of this event's club.
    const club = await Club.findById(event.club).lean();
    if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
    if (!club.admins.some((a: any) => a.user.toString() === resolvedUser.id)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const registrations = await EventRegistration.find({
      event: eventId,
      status: 'registered',
    })
      .sort({ registeredAt: 1 })
      .lean();

    return NextResponse.json({
      registrations,
      total: registrations.length,
    });
  } catch (err) {
    console.error('[GET /api/events/[eventId]/registrations]', err);
    const errorId = logError(err, { endpoint: 'UNKNOWN /api/events/[eventId]/register' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}