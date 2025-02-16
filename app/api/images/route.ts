import { NextRequest, NextResponse } from "next/server";
import ImageModel from "@/app/models/Image";
import connectToDatabase from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const { imageData, contentType } = await req.json();

    if (!imageData || !contentType) {
      return NextResponse.json(
        { error: "Image data and content type are required." },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(imageData.split(",")[1], "base64");

    const image = new ImageModel({
      contentType,
      data: buffer,
    });

    await image.save();

    return NextResponse.json({ imageUrl: `/api/images/${image._id}` });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image." },
      { status: 500 }
    );
  }
}
