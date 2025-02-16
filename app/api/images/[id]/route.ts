import { NextRequest, NextResponse } from "next/server";
import Image from "@/app/models/Image";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { params } = context;
  const { id } = await params;
  try {
    await connectToDatabase();
   
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
    }

    const image = await Image.findById(id);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return new NextResponse(image.data, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": image.data.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json(
      { error: "Failed to fetch image." },
      { status: 500 }
    );
  }
}
