import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Club } from '@/app/models/Club';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import { logError } from '@/lib/sentry/logger';

// GET /api/club/[clubId] — returns club info if the logged-in user is one of its admins
export async function GET(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    
    const { clubId } = await params;
    if (!mongoose.isValidObjectId(clubId)) {
      return NextResponse.json({ error: 'Invalid clubId' }, { status: 400 });
    }

    const club = await Club.findById(clubId).lean();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

    const isAdmin = club.admins.some(
      (a: any) => a.user.toString() === user.id.toString()
    );
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ club });
  } catch (err) {
    console.error('[GET /api/club/[clubId]]', err);
    const errorId = logError(err, { endpoint: 'UNKNOWN /api/club/[clubId]' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}