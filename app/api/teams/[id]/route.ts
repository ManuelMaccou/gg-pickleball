import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Team from '@/app/models/Team';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  try {
    await connectToDatabase();
    const { teammateId, registrationStep } = await request.json();

    if (!teammateId) {
      return NextResponse.json(
        { systemMessage: 'teammateId is required', userMessage: 'An unexpected error occurred.' },
        { status: 400 }
      );
    }

    const team = await Team.findById(id);

    if (!team) {
      return NextResponse.json(
        { systemMessage: 'Team not found', userMessage: 'An unexpected error occurred.' },
        { status: 404 }
      );
    }

    // Add the second teammate if not already present
    if (!team.teammates.includes(teammateId)) {
      team.teammates.push(teammateId);
    }

    if (registrationStep) {
      team.registrationStep = registrationStep;
    }

    await team.save();

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { systemMessage: 'Internal server error', userMessage: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
