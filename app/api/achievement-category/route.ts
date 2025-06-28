import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { IAchievementCategory } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import AchievementCategory from '@/app/models/AchievementCategory';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await req.json();

    const categories = Array.isArray(body) ? body : [body];
    const createdCategories = [];

    for (const cat of categories) {
      const { name, description, milestones } = cat as IAchievementCategory;

      if (!name || !description) {
        logError(new Error('Name or description not provided for one of the categories'), {
          endpoint: 'POST /api/achievement-category',
          task: 'Saving achievement categories'
        });
        continue; // Skip invalid entry
      }

      const newAchievementCategory = new AchievementCategory({ name, description, milestones });
      await newAchievementCategory.save();
      createdCategories.push(newAchievementCategory);
    }

    return NextResponse.json({ message: 'Achievement categories created', createdCategories }, { status: 201 });

  } catch (error) {
    logError(error, {
      endpoint: 'POST /api/achievement-category',
      message: 'Failed to create achievement categories',
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  
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
