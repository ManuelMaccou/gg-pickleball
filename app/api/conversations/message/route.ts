import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Conversation from "@/app/models/Conversation";
import User from "@/app/models/User";
import Match from "@/app/models/Match";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const { 
      matchId, text, userId, systemMessage = false 
    } :
      {
        matchId: string, text: string, userId: string, systemMessage: boolean
      } = await request.json();

    if (!matchId || !text) {
      return NextResponse.json(
        { error: "matchId, text, and userId are required." },
        { status: 400 }
      );
    }

    // Check if match exists
    const match = await Match.findById(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    if (!systemMessage) {
      // Check if the user exists
      const user = await User.findById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }
    }
    

    // Find the conversation for this match
    const conversation = await Conversation.findOne({ matchId });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    // Append the new message
    const newMessage = {
      user: userId,
      text,
      systemMessage,
      createdAt: new Date(),
    };

    conversation.messages.push(newMessage);

    // Save the conversation
    await conversation.save();

    return NextResponse.json({ newMessage, conversation }, { status: 200 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
