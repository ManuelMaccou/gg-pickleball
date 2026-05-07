import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { logError } from "@/lib/sentry/logger";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const locationId = searchParams.get("locationId");
  const after = searchParams.get("after");
  const lastId = searchParams.get("lastId");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    await connectToDatabase();

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid User ID." }, { status: 400 });
    }

    if (locationId && !Types.ObjectId.isValid(locationId)) {
      return NextResponse.json({ error: "Invalid Location ID." }, { status: 400 });
    }

    const conditions: any[] = [];
    const userObjectId = new Types.ObjectId(userId);

    // 1. Filter by User (Must be in Team 1 or Team 2)
    conditions.push({
      $or: [
        { "team1.players": userObjectId },
        { "team2.players": userObjectId },
      ],
    });

    // 2. Filter by Context (Location OR Data Source)
    // FIX: This allows finding DUPR matches (via dataSourceId) 
    // AND Club matches (via location) using the same ID parameter.
    if (locationId) {
      conditions.push({
        $or: [
          { location: new Types.ObjectId(locationId) },
          { dataSourceId: new Types.ObjectId(locationId) }
        ]
      });
    }

    // 3. Pagination (Cursor-based)
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
    logError(error, {
      message: `Error fetching match history for userId: ${userId}`,
      locationId: locationId
    });
    return NextResponse.json({ error: "There was an unexpected error. Please try again." }, { status: 500 });
  }
}