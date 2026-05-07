// app/api/dupr/club-members/route.ts
//
// Proxy for DUPR's club members endpoint.
// Takes the internal MongoDB club _id, looks up the DUPR club ID,
// then fetches the member list using the app-level token.

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { authenticatedDuprFetch } from '@/lib/services/dupr/duprAuth';
import connectToDatabase from '@/lib/mongodb';
import { Club } from '@/app/models/Club';

function parseDuprRating(val: unknown): number | null {
  if (val == null || val === 'NR') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');

    if (!clubId || !mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'Valid clubId is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // Look up the DUPR club ID from the Club document.
    const club = await Club.findById(clubId).select('duprClubId admins').lean() as {
      duprClubId?: string;
      admins: { user: mongoose.Types.ObjectId }[];
    } | null;

    if (!club) {
      return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
    }

    // Verify the requesting user is an admin of this club.
    if (!club.admins.some((a) => a.user.toString() === user.id)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (!club.duprClubId) {
      return NextResponse.json({ error: 'Club has no DUPR ID linked.' }, { status: 400 });
    }

    const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
    if (!DUPR_API_BASE_URL) {
      return NextResponse.json({ error: 'DUPR configuration error.' }, { status: 500 });
    }

    const response = await authenticatedDuprFetch(
      `https://${DUPR_API_BASE_URL}/api/club/v1.0/members`,
      {
        method: 'POST',
        body: JSON.stringify({ clubId: Number(club.duprClubId) }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DUPR Club Members] API failed (${response.status}):`, errText);
      return NextResponse.json(
        { error: 'Failed to fetch club members from DUPR. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();

    const members = (data?.results ?? []).map((m: any) => ({
      duprId: m.id,
      fullName: m.fullName ?? 'Unknown',
      doublesRating: parseDuprRating(m.ratings?.doubles),
    }));

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[GET /api/dupr/club-members]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}