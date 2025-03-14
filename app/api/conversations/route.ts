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
      ? new mongoose.Types.ObjectId("67bf5eee8dd2fb5ee5a40cba")
      : new mongoose.Types.ObjectId("67d32c45878c39e7ef4a357b") ;

    if (!userIds.some(id => id.equals(adminId))) {
      userIds.push(adminId);
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
