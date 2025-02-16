import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

type Params = {
  userId: string;
};

export async function GET(request: Request, context: { params: Params }) {
  try {
    await connectToDatabase();
    const { userId } = context.params;

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
