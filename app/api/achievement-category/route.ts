import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { IAchievementCategory } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import AchievementCategory from '@/app/models/AchievementCategory';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { name, description, milestones } = body as IAchievementCategory;

    if (!name || !description ) {
      logError(new Error('Name or description not provided.'), {
        endpoint: 'POST /api/achievement-catory',
        task: 'Saving a new achievement category'
      });

      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 });
    }

    const newAchievementCategory = new AchievementCategory({ name, description, milestones });
    await newAchievementCategory.save();

    return NextResponse.json({ message: 'Achievement category created', AchievementCategory: newAchievementCategory }, { status: 201 });
  } catch (error) {
     logError(error, {
      endpoint: 'POST /api/achievement-category',
      message: 'Failed to create new achievement category',
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  
  try {
    await connectToDatabase();

    const achievementCategories = await AchievementCategory.find();
    return NextResponse.json({ achievementCategories });

  } catch (error) {
    logError(error, {
      endpoint: 'GET /api/achievement-category',
      message: 'Failed to fetch all achievemenet categories',
    });
    
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
