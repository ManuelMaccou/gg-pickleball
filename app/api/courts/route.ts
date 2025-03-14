import { NextRequest, NextResponse } from "next/server";

import Court from "@/app/models/Court";
import connectToDatabase from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { name, address, availability } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    if (!availability) {
      return NextResponse.json({ error: "Availability is required" }, { status: 400 });
    }

    const newCourt = new Court({
      name,
      address,
      availability,
    });

    await newCourt.save();

    return NextResponse.json({ message: "Court created successfully", court: newCourt }, { status: 201 });
  } catch (error) {
    console.error("Error creating court:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const regionId = searchParams.get("regionId");

    // Finds only a single court
    if (id) {
      const court = await Court.findById(id);
      if (!court) {
        return NextResponse.json({ message: "Court not found" }, { status: 404 });
      }
      return NextResponse.json({ court });
    }

    // Finds all courts in the region
    if (regionId) {
      const courts = await Court.find({ regionId });

      if (courts.length === 0) {
        return NextResponse.json({ message: "No courts found for this region." }, { status: 404 });
      }

      return NextResponse.json({ courts });
    }

    return NextResponse.json({ error: "Missing query parameter: id or regionId required" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching courts:", error);
    return NextResponse.json(
      { systemMessage: "Internal Server Error", userMessage: "Something went wrong. Please try again. Code 500" },
      { status: 500 }
    );
  }
}