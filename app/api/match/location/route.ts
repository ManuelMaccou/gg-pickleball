import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";
import { logError } from "@/lib/sentry/logger";
import { getAuthorizedUser } from "@/lib/auth/getAuthorizeduser";

export async function GET(request: NextRequest) {

  const user = await getAuthorizedUser(request)
  console.log('authd user:', user)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");

  try {
    await connectToDatabase();

    if (!locationId) {
      logError(new Error('LocationId not provided in query params.'), {
        endpoint: 'GET /api/match/location',
        task: 'Fetching matches by location for admin page'
      });
      return NextResponse.json({ error: "locationId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(locationId)) {
      logError(new Error('Invalid locationId format.'), {
        endpoint: 'GET /api/match/location',
        task: 'Fetching matches by location for admin page'
      });
      return NextResponse.json({ error: "Invalid locationId format." }, { status: 400 });
    }

    const matches = await Match.find({ location: locationId })
      .populate("team1.players")
      .populate("team2.players")
      .populate("winners")
      .populate("location");

    return NextResponse.json({ matches }, { status: 200 });
  } catch (error) {
    logError(error, {
      message: `Error fetching matches at locationID: ${locationId} for admin page`
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
