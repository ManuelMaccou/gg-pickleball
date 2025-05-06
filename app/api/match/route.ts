import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Match from '@/app/models/Match';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const { matchId, team1, team2, winners, location } = await req.json();

    if (!matchId || !team1 || !team2 || !winners) {
      return NextResponse.json({ success: false, error: 'Missing required data.' }, { status: 400 });
    }

    // Save match details
    const match = new Match({
      matchId,
      team1,
      team2,
      winners,
      location,
    });

    await match.save();

    console.log('saved match:', match)

    return NextResponse.json({ 
      success: true,
      match: {
        ...match.toObject(),
        _id: match._id.toString(),
      }
    });

  } catch (error) {
    console.error('Failed to save match:', error);
    return NextResponse.json({ success: false, error: 'Failed to save match.' }, { status: 500 });
  }
}
