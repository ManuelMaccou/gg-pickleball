import Achievement from "@/app/models/Achievement";
import connectToDatabase from "@/lib/mongodb";
import { logError } from "@/lib/sentry/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const categoryId = req.nextUrl.searchParams.get('id');

    const achievements = categoryId
      ? await Achievement.find({ categoryId })
      : await Achievement.find();

    return NextResponse.json({ achievements });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/achievement/category' });
    return NextResponse.json({ error: 'Failed to fetch achievements', errorId }, { status: 500 });
  }
}
