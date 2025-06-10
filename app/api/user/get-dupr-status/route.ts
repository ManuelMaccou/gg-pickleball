import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import { logError } from "@/lib/sentry/logger";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { userIds } = await req.json();

    if (!Array.isArray(userIds)) {
      logError(new Error('Expected the requeset body to have an array of userIds.'), {
        endpoint: 'POST /api/user/get-dupr-status',
        task: 'Checking if all users in a match want matches uploaded to DUPR'
      });

      return NextResponse.json({ error: "Invalid userIds array" }, { status: 400 });
    }

    const users = await User.find({ _id: { $in: userIds } }, { _id: 1, dupr: 1 });

    return NextResponse.json({ users });
  } catch (error) {
    logError(error, {
      endpoint: 'POST /api/user/get-dupr-status',
      message: 'Failed to check dupr status',
    });

    return NextResponse.json({ error: "Failed to check dupr status" }, { status: 500 });
  }
}
