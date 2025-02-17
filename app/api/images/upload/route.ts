import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ImageModel from "@/app/models/Image";
import connectToDatabase from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const { filePath, contentType } = await req.json();

    if (!filePath || !contentType) {
      return NextResponse.json(
        { error: "filePath and contentType are required." },
        { status: 400 }
      );
    }

    // Resolve path to public folder
    const absolutePath = path.join(process.cwd(), "public", filePath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: `File not found: ${absolutePath}` },
        { status: 404 }
      );
    }

    // Read file as Buffer
    const fileBuffer = fs.readFileSync(absolutePath);

    // Save to MongoDB
    const image = new ImageModel({
      contentType,
      data: fileBuffer,
    });

    await image.save();

    // Return image URL in the expected format
    return NextResponse.json({ imageUrl: `api/images/${image._id}` });
  } catch (error) {
    console.error("Error uploading image from file path:", error);
    return NextResponse.json(
      { error: "Failed to upload image from file path." },
      { status: 500 }
    );
  }
}
