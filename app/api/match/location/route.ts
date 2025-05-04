import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Match from "@/app/models/Match";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(locationId)) {
      return NextResponse.json({ error: "Invalid locationId format." }, { status: 400 });
    }

    const matches = await Match.find({ location: locationId })
      .populate("team1.players")
      .populate("team2.players")
      .populate("winners")
      .populate("location");

    return NextResponse.json({ matches }, { status: 200 });
  } catch (error) {
    console.error("Error fetching matches by location:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
