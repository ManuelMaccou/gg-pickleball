import { NextRequest, NextResponse } from "next/server";
import { FilterQuery, Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { IMatch } from "@/app/types/databaseTypes";
import { logError } from "@/lib/sentry/logger";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";

export async function GET(request: NextRequest) {
  
  const user = await getAuthorizedUser(request)
  console.log('authd user:', user)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const after = searchParams.get("after");
  const lastId = searchParams.get("lastId");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    await connectToDatabase();

    if (!userId) {
      logError(new Error('UserId not included in query params.'), {
        endpoint: 'GET /api/match/user',
        task: 'Fetching match history for a player'
      });

      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId)) {
      logError(new Error('Invalid userId format.'), {
        endpoint: 'GET /api/match/user',
        task: 'Fetching match history for a player'
      });

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
    logError(error, {
      message: `Error fetching match history for userId: ${userId}`
    });
    
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
