import { NextResponse } from "next/server";
import { FilterQuery, Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { IMatch } from "@/app/types/databaseTypes";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const after = searchParams.get("after"); // ISO timestamp
    const lastId = searchParams.get("lastId"); // ObjectId string
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid userId format." }, { status: 400 });
    }

    const query: FilterQuery<IMatch> = {
      $or: [
        { "team1.players": new Types.ObjectId(userId) },
        { "team2.players": new Types.ObjectId(userId) },
      ],
    };

    if (after && lastId && Types.ObjectId.isValid(lastId)) {
      query.$or = [
        {
          $and: [
            { createdAt: { $lt: new Date(after) } },
          ],
        },
        {
          $and: [
            { createdAt: { $eq: new Date(after) } },
            { _id: { $lt: new Types.ObjectId(lastId) } },
          ],
        },
      ];
    }

    const matches = await Match.find(query)
      .populate("team1.players", "name _id")
      .populate("team2.players", "name _id")
      .populate("winners", "_id")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);

    return NextResponse.json({
      matches,
      hasNextPage: matches.length === limit,
    });
  } catch (error) {
    console.error("Error fetching cursor-paginated matches:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
