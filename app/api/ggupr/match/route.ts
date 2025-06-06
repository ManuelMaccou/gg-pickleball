import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import GguprMatch from '@/app/models/GguprMatch';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const { matchId, team1, team2, winners, location } = await req.json();

    if (!matchId || !team1 || !team2 || !winners) {
      return NextResponse.json({ success: false, error: 'Missing required data.' }, { status: 400 });
    }

    // Save match details
    const match = await GguprMatch.create({
      matchId,
      team1,
      team2,
      winners,
      location,
    });

    return NextResponse.json({ success: true, match });
  } catch (error) {
    console.error('Failed to save match:', error);
    return NextResponse.json({ success: false, error: 'Failed to save match.' }, { status: 500 });
  }
}
