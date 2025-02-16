import { NextRequest, NextResponse } from "next/server";

import Season from "@/app/models/Season";
import connectToDatabase from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { season, startDate } = body;

    if (!season) {
      return NextResponse.json({ error: "Season is required" }, { status: 400 });
    }

    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }

    const newSeason = new Season({
      season,
      startDate,
    });

    await newSeason.save();

    return NextResponse.json({ message: "Season created successfully", season: newSeason }, { status: 201 });
  } catch (error) {
    console.error("Error creating season:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
