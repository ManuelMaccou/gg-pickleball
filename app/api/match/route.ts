import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Match from '@/app/models/Match';
import { logError } from '@/lib/sentry/logger';
import { Types } from 'mongoose';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  let team1: { players: Types.ObjectId[]; score: number } | undefined,
    team2: { players: Types.ObjectId[]; score: number } | undefined,
    matchId: string | undefined,
    winners: Types.ObjectId[] | undefined,
    location: string | undefined,
    logToDupr: boolean | undefined;

  try {
    const body = await req.json();

    matchId = body.matchId;
    team1 = body.team1;
    team2 = body.team2;
    winners = body.winners;
    location = body.location;
    logToDupr = body.logToDupr;

    if (!matchId || !team1 || !team2 || !winners) {
      logError(new Error('Missing required data in the request body'), {
        endpoint: 'POST /api/match',
        task: 'Saving a match',
        matchId: matchId ?? "undefinded",
        team1: team1 ?? "undefinded",
        team2: team2 ?? "undefinded",
        winners: winners ?? "undefinded",
        lcoation: location ?? "undefinded",
        logToDupr: logToDupr ?? "undefinded",
      });

      return NextResponse.json({ success: false, error: 'Missing required data.' }, { status: 400 });
    }

    // Save match details
    const match = new Match({
      matchId,
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
    logError(error, {
      message: 'Failed to save match for teams',
      team1Players: team1?.players ?? "team1 undefined",
      team2Players: team2?.players ?? "team 2 undefined",
    });

    return NextResponse.json({ success: false, error: 'Failed to save match.' }, { status: 500 });
  }
}
