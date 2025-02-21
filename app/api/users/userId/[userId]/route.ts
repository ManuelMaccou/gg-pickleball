import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

export async function GET(
  request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
  ) {
    
  try {
    await connectToDatabase();
    const userId = (await params).userId;

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { systemMessage: 'User not found.', userMessage: 'User not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return NextResponse.json(
      { systemMessage: 'Internal Server Error', userMessage: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
