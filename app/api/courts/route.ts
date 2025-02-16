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
