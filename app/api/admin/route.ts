import { Types } from "mongoose";
import Admin from "@/app/models/Admin";
import connectToDatabase from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "UserId is required." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid userId format." }, { status: 400 });
    }

    const admin = await Admin.findOne({ user: userId }).populate("location");

    if (!admin) {
      return NextResponse.json({ error: "Admin not found." }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error) {
    console.error("Failed to fetch admin:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { user, location, bannerColor } = body;

    if (!user || !location) {
      return NextResponse.json({ error: "Missing required fields: user and location." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(user) || !Types.ObjectId.isValid(location)) {
      return NextResponse.json({ error: "Invalid user or location ID." }, { status: 400 });
    }

    const admin = new Admin({
      user,
      location,
      bannerColor: bannerColor || null,
    });

    await admin.save();

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
