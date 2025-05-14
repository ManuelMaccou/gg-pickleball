import { NextResponse } from "next/server";
import { FilterQuery, Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { IMatch } from "@/app/types/databaseTypes";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const after = searchParams.get("after");
    const lastId = searchParams.get("lastId");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(locationId)) {
      return NextResponse.json({ error: "Invalid locationId format." }, { status: 400 });
    }

    const query: FilterQuery<IMatch> = { location: new Types.ObjectId(locationId) };

    if (after && lastId && Types.ObjectId.isValid(lastId)) {
      query.$or = [
        { createdAt: { $lt: new Date(after) } },
        {
          createdAt: { $eq: new Date(after) },
          _id: { $lt: new Types.ObjectId(lastId) },
        },
      ];
    }

    const matches = await Match.find(query)
      .populate("team1.players")
      .populate("team2.players")
      .populate("winners")
      .populate("location")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);

    return NextResponse.json({
      matches,
      hasNextPage: matches.length === limit,
    });
  } catch (error) {
    console.error("Error fetching matches by location:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
