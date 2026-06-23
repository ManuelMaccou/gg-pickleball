import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import { IAchievement } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
    
  try {
    await connectToDatabase();

    const body = await req.json();

    const { index, friendlyName, name, badge, categoryId } = body as IAchievement;

    if (!friendlyName || !name || !badge) {
      logError(new Error('Name or badge not provided.'), {
        endpoint: 'POST /api/achievement',
        task: 'Saving a new achievement'
      });

      return NextResponse.json({ error: 'Name and badge are required' }, { status: 400 });
    }

    const newAchievement = new Achievement({ index, friendlyName, name, badge, categoryId });
    await newAchievement.save();

    return NextResponse.json({ message: 'Achievement created', achievement: newAchievement }, { status: 201 });
  } catch (error) {
     const errorId = logError(error, {
      endpoint: 'POST /api/achievements',
      message: 'Failed to create new achievement object',
    });

    return NextResponse.json({ errorId, error: 'There was an unexpected error. We are looking into it.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  
  try {
    await connectToDatabase();

    if (name) {
      const achievement = await Achievement.findOne({ name });
      if (!achievement) {
        logError(new Error('Achievement not found.'), {
          endpoint: 'GET /api/achievement',
          task: 'Fetching an existing achievement'
        });

        return NextResponse.json({ error: 'Achievement not found. Please try again.' }, { status: 404 });
      }
      return NextResponse.json({ achievement });
    }

    const achievements = await Achievement.find();
    return NextResponse.json({ achievements });

  } catch (error) {
    const errorId = logError(error, {
      endpoint: 'GET /api/achievements',
      message: name ? `Failed to fetch achievement with name: ${name}` : 'Failed to fetch all achievements',
    });
    
    return NextResponse.json({ errorId, error: 'There was an unexpected error. We are looking into it.' }, { status: 500 });
  }
}
