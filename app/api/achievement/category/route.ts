import Achievement from "@/app/models/Achievement";
import connectToDatabase from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  await connectToDatabase();
  const categoryId = req.nextUrl.searchParams.get('id');

  const achievements = categoryId
    ? await Achievement.find({ categoryId })
    : await Achievement.find();

  return NextResponse.json({ achievements });
}
