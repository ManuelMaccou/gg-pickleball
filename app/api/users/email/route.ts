import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { systemMessage: 'Email is required.', userMessage: 'Please provide an email address.' },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ exists: false, message: 'User not found' }, { status: 200 });
    }

    return NextResponse.json({ exists: true, user });
  } catch (error) {
    console.error('Error searching user by email:', error);
    return NextResponse.json(
      { systemMessage: 'Internal Server Error', userMessage: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
