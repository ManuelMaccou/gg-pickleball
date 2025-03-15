import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Team from '@/app/models/Team';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const seasonId = searchParams.get('seasonId');

  if (!userId || !seasonId) {
    return NextResponse.json(
      { systemMessage: 'userId and seasonId are required', userMessage: 'Missing required parameters.' },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const team = await Team.findOne({
      teammates: userId,
      seasonId: seasonId,
    }).populate('teammates', 'name email availability');

    if (!team) {
      return NextResponse.json(
        { systemMessage: 'Team not found', userMessage: 'No team found for this user and season.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error fetching team by user and season:', error);
    return NextResponse.json(
      { systemMessage: 'Internal server error', userMessage: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
