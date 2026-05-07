import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Club } from '@/app/models/Club';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { verifyDuprEntitlement } from '@/lib/services/dupr/duprEntitlement';
import { fetchUserDuprClubs } from '@/lib/services/dupr/duprClubs';
import connectToDatabase from '@/lib/mongodb';

// GET /api/club?adminId=...
// Returns clubs the user already has in our system
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('adminId');

    if (!adminId || !mongoose.isValidObjectId(adminId)) {
      return NextResponse.json({ error: 'adminId required' }, { status: 400 });
    }

    if (adminId !== user.id.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clubs = await Club.find({ 'admins.user': adminId })
      .select('name duprClubId createdAt')
      .lean();

    return NextResponse.json({ clubs });
  } catch (err) {
    console.error('[GET /api/club]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/club
// Body: { action: 'fetch-dupr-clubs' } — returns available DUPR clubs to connect
// Body: { action: 'connect', duprClubId, clubName, duprRole } — connects a DUPR club
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const body = await req.json();
    const { action } = body ?? {};

    // Step 1: Verify entitlement for any club action
    const entitlement = await verifyDuprEntitlement(user.id);
    if (!entitlement.ok) {
      return NextResponse.json({ error: entitlement.error }, { status: entitlement.status });
    }

    // --- Fetch available DUPR clubs ---
    if (action === 'fetch-dupr-clubs') {
      try {
        const duprClubs = await fetchUserDuprClubs(user.id);

        // Check which ones are already connected in our system
        const existingClubs = await Club.find({
          duprClubId: { $in: duprClubs.map((c) => String(c.clubId)) },
          'admins.user': user.id,
        })
          .select('duprClubId')
          .lean();

        const connectedIds = new Set(existingClubs.map((c) => String((c as any).duprClubId)));

        const clubsWithStatus = duprClubs.map((c) => ({
          ...c,
          alreadyConnected: connectedIds.has(String(c.clubId)),
        }));

        return NextResponse.json({ clubs: clubsWithStatus });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch DUPR clubs' },
          { status: 502 }
        );
      }
    }

    // --- Connect a DUPR club ---
    if (action === 'connect') {
      const { duprClubId, clubName, duprRole } = body;

      if (!duprClubId || !clubName || !duprRole) {
        return NextResponse.json({ error: 'duprClubId, clubName, and duprRole are required.' }, { status: 400 });
      }

      if (!['ORGANIZER', 'DIRECTOR'].includes(duprRole)) {
        return NextResponse.json({ error: 'Invalid role. Must be ORGANIZER or DIRECTOR.' }, { status: 400 });
      }

      // Check if this DUPR club already exists in our system
      let club = await Club.findOne({ duprClubId: String(duprClubId) });

      if (club) {
        // Club exists — check if this user is already an admin
        const isAlreadyAdmin = club.admins.some(
          (a: any) => a.user.toString() === user.id.toString()
        );

        if (isAlreadyAdmin) {
          return NextResponse.json({ error: 'You are already connected to this club.' }, { status: 409 });
        }

        // Add user as admin
        club.admins.push({ user: new mongoose.Types.ObjectId(user.id), duprRole } as any);
        await club.save();
      } else {
        // Create new club
        club = await Club.create({
          name: clubName,
          duprClubId: String(duprClubId),
          admins: [{ user: user.id, duprRole }],
        });
      }

      return NextResponse.json({ club }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/club]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}