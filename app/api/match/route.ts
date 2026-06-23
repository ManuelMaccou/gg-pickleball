import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Match from '@/app/models/Match';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    
  await connectToDatabase();

  try {
    const body = await req.json();
    const {
      matchId,
      matchDate: receivedMatchDate,
      team1,
      team2,
      winners,
      location,
      logToDupr,
    } = body;

    if (!matchId || !team1 || !team2 || !winners || !location || !receivedMatchDate) {
      logError(new Error('Missing required data in the request body'), {
        endpoint: 'POST /api/match',
        task: 'Saving a match',
        body: body,
      });

      return NextResponse.json({ success: false, error: 'Missing required data. Please try again.' }, { status: 400 });
    }

    const matchDate = new Date(receivedMatchDate);
    if (isNaN(matchDate.getTime())) {
      logError(new Error('Invalid date format received from internal service'), { body });
      return NextResponse.json({ success: false, error: 'Invalid date format received.' }, { status: 400 });
    }

    // Save match details
    const match = new Match({
      matchId,
      matchDate,
      team1,
      team2,
      winners,
      location,
      logToDupr,
    });

    await match.save();

    return NextResponse.json({ 
      success: true,
      match: {
        ...match.toObject(),
        _id: match._id.toString(),
      }
    });

  } catch (error) {
    const errorId = logError(error, {
      message: 'Failed to save match from real-time service',
      endpoint: 'POST /api/match',
    });

    return NextResponse.json({ errorId, success: false, error: 'There was an error saving the match.' }, { status: 500 });
  }
}