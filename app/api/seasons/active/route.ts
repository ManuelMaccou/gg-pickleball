import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Season from '@/app/models/Season';

export async function GET() {
  try {
    await connectToDatabase();

    const activeSeason = await Season.findOne({ active: true });

    if (!activeSeason) {
      return NextResponse.json(
        { 
          systemMessage: "No active season found in the database.", 
          userMessage: "An unexpected error happened. Please try again. Code 422" 
        }, { status: 404 });
    }

    
    return NextResponse.json(activeSeason, { status: 200 });
  } catch (error) {
    console.error('Error fetching active season:', error);
    
    return NextResponse.json(
      { 
        systemMessage: "Internal server error.", 
        userMessage: "An unexpected error happened. Please try again. Code 423" 
      }, { status: 500 });
  }
}
