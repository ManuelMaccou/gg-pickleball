import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Conversation from '@/app/models/Conversation';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const matchId = searchParams.get('matchId');
  const userIdsString = searchParams.get("userIds");

  try {
    if (!matchId || !userIdsString) {
      return NextResponse.json(
        { error: "matchId and userIds are required." },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const userIds = userIdsString.split(",").map((id) => new mongoose.Types.ObjectId(id));

    const adminId = process.env.NEXT_PUBLIC_ENV === 'dev'
      ? "67bf5eee8dd2fb5ee5a40cba"
      : "67d4a1cf3a795dc67a9a3915";

    if (!userIds.some(id => id.equals(new mongoose.Types.ObjectId(adminId)))) {
      userIds.push(new mongoose.Types.ObjectId(adminId));
    }
   
    let conversation = await Conversation.findOne({ matchId });

    if (!conversation) {
      conversation = new Conversation({
        matchId,
        users: userIds,
        messages: [],
      });

      await conversation.save();
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error(`Error fetching conversation by matchId ${request.nextUrl.searchParams.get("matchId")}:`, error);
    return NextResponse.json(
      { systemMessage: 'Internal Server Error', userMessage: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
