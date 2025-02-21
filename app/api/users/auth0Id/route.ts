import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const auth0Id = searchParams.get('auth0Id')
  try {
    await connectToDatabase();
    
    console.log('auth0Id:', auth0Id);

    const user = await User.findOne({ auth0Id: auth0Id });

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
