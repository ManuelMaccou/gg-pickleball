import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Region from "@/app/models/Region";


export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const newRegion = new Region({
      name
    });

    await newRegion.save();

    return NextResponse.json({ message: "Region created successfully", region: newRegion }, { status: 201 });
  } catch (error) {
    console.error("Error creating region:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();

    const region = await Region.findOne({ name: "Santa Monica" });

    if (!region) {
      return NextResponse.json(
        { 
          systemMessage: "No region found in the database.", 
          userMessage: "An unexpected error happened. Please try again." 
        }, { status: 404 });
    }

    
    return NextResponse.json(region, { status: 200 });
  } catch (error) {
    console.error('Error fetching active season:', error);
    
    return NextResponse.json(
      { 
        systemMessage: "Internal server error.", 
        userMessage: "An unexpected error happened. Please try again." 
      }, { status: 500 });
  }
}
