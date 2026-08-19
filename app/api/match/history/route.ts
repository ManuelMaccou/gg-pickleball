// Destination: app/api/match/history/route.ts
// (Renamed from user-and-location — locationId filtering is gone, so the
// old name was actively misleading. MatchHistory.tsx's fetch URL updated
// to match, in the same pass.)

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const after = searchParams.get("after");
  const lastId = searchParams.get("lastId");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    await connectToDatabase();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid User ID." }, { status: 400 });
    }

    const conditions: any[] = [];
    const userObjectId = new Types.ObjectId(userId);

    // Filter by User (must be in Team 1 or Team 2)
    conditions.push({
      $or: [
        { "team1.players": userObjectId },
        { "team2.players": userObjectId },
      ],
    });

    // Pagination (cursor-based) — unchanged
    if (after && lastId && Types.ObjectId.isValid(lastId)) {
      conditions.push({
        $or: [
          { matchDate: { $lt: new Date(after) } },
          {
            matchDate: { $eq: new Date(after) },
            _id: { $lt: new Types.ObjectId(lastId) },
          },
        ],
      });
    }

    const query = { $and: conditions };

    const matches = await Match.find(query)
      .populate("team1.players", "name _id")
      .populate("team2.players", "name _id")
      .populate("winners", "_id")
      .sort({ matchDate: -1, _id: -1 })
      .limit(limit + 1);

    const hasNextPage = matches.length > limit;
    const trimmedMatches = hasNextPage ? matches.slice(0, limit) : matches;

    return NextResponse.json({
      matches: trimmedMatches,
      hasNextPage,
    });
  } catch (error) {
    const errorId = logError(error, {
      message: `Error fetching match history for userId: ${userId}`,
      endpoint: 'GET /api/match/history'
    });
    return NextResponse.json({ errorId, error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}