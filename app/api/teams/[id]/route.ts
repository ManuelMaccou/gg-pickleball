import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Team from '@/app/models/Team';

type Params = {
  id: string;
};

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await connectToDatabase();

  try {
    const { teammateId, registrationStep } = await req.json();
    const { id } = params;

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
