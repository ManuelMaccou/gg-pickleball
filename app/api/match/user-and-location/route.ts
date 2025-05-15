import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const locationId = searchParams.get("locationId");
    const after = searchParams.get("after");
    const lastId = searchParams.get("lastId");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid userId format." }, { status: 400 });
    }

    if (locationId && !Types.ObjectId.isValid(locationId)) {
      return NextResponse.json({ error: "Invalid locationId format." }, { status: 400 });
    }

    const userQuery = {
      $or: [
        { "team1.players": userId },
        { "team2.players": userId },
      ],
    };

    const cursorFilter = after && lastId && Types.ObjectId.isValid(lastId)
      ? {
          $or: [
            { createdAt: { $lt: new Date(after) } },
            {
              createdAt: { $eq: new Date(after) },
              _id: { $lt: new Types.ObjectId(lastId) },
            },
          ],
        }
      : {};

    const locationFilter = locationId ? { location: locationId } : {};

    const query = {
      ...userQuery,
      ...locationFilter,
      ...cursorFilter,
    };

    const matches = await Match.find(query)
      .populate("team1.players", "name _id")
      .populate("team2.players", "name _id")
      .populate("winners", "_id")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasNextPage = matches.length > limit;
    const trimmedMatches = hasNextPage ? matches.slice(0, limit) : matches;

    return NextResponse.json({
      matches: trimmedMatches,
      hasNextPage,
    });
  } catch (error) {
    console.error("Error fetching user matches by location:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
