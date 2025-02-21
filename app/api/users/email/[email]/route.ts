import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const email = (await params).email;
  if (!email) {
    return NextResponse.json(
      { systemMessage: 'email is required', userMessage: 'An unexpected error occurred.' },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const body = await request.json()

    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { systemMessage: 'No fields to update', userMessage: 'No data provided.' },
        { status: 400 }
      )
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: body },
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json(
        { systemMessage: 'User not found', userMessage: 'An unexpected error occurred.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { systemMessage: 'Internal server error', userMessage: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
