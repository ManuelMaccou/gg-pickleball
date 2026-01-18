import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { logError } from "@/lib/sentry/logger";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import Match from "@/app/models/Match";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  try {
    await connectToDatabase();

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Valid Client ID is required' }, { status: 400 });
    }

    const objectIdClient = new Types.ObjectId(clientId);

    // 1. Get Unique Player Count (Fast count based on index)
    const uniquePlayerCount = await User.countDocuments({
      "stats.global.rewards.sponsoringClientId": objectIdClient
    });

    // 2. Get Top 5 Players by Wins
    // We sort by stats.global.wins using .lean() for speed
    const topPlayersRaw = await User.find({
      "stats.global.rewards.sponsoringClientId": objectIdClient,
      "stats.global.wins": { $exists: true, $gt: 0 }
    })
    .sort({ "stats.global.wins": -1 })
    .limit(5)
    .select("name stats.global.wins")
    .lean();

    const topPlayers = topPlayersRaw.map(p => ({
      name: p.name,
      winCount: p.stats?.global?.wins || 0
    }));

    return NextResponse.json({
      uniquePlayerCount,
      topPlayers
    });

  } catch (error) {
    logError(error, { endpoint: 'GET /api/brand/stats', clientId: clientId ?? 'null' });
    return NextResponse.json({ error: 'Failed to fetch stats.' }, { status: 500 });
  }
}