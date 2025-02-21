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
    const body = await request.json();

    const { teammateId, ...updateFields } = body;

    const team = await Team.findById(id);

    if (!team) {
      return NextResponse.json(
        { systemMessage: 'Team not found', userMessage: 'An unexpected error occurred.' },
        { status: 404 }
      );
    }

    if (teammateId) {
      if (!team.teammates.includes(teammateId)) {
        team.teammates.push(teammateId);
      }
    }

    // Update the rest of the fields dynamically
    Object.entries(updateFields).forEach(([key, value]) => {
      if (value !== undefined && key in team) {
        (team.set as (path: string, val: unknown) => void)(key, value);
      }
    });

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
