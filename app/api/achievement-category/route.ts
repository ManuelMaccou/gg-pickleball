import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { IAchievementCategory } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import AchievementCategory from '@/app/models/AchievementCategory';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
// import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {
  // const user = await getAuthorizedUser(req);
  // if (!user) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

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
        continue;
      }

      const newAchievementCategory = new AchievementCategory({ name, description, milestones });
      await newAchievementCategory.save();

      createdCategories.push(newAchievementCategory);
    }

    return NextResponse.json({ message: 'Achievement categories created', createdCategories }, { status: 201 });

  } catch (error) {
    const errorId = logError(error, {
      endpoint: 'POST /api/achievement-category',
      message: 'Failed to create achievement categories',
    });

    return NextResponse.json({ errorId, error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // 1. Authorization: Added standard security check.
  // Assumes 'admin' or 'superAdmin' can access this. Adjust if needed.
  const authorizedUser = await getAuthorizedUser(request);
  if (!authorizedUser || (authorizedUser.permission !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    await connectToDatabase();

    // 2. Build a conditional query object.
    const query: { scope?: string } = {};
    if (scope) {
      query.scope = scope;
    }

    // 3. Use the query object in the .find() method.
    const achievementCategories = await AchievementCategory.find(query).sort({ index: 1 });

    return NextResponse.json({ achievementCategories });

  } catch (error) {
    const errorId = logError(error, {
      endpoint: 'GET /api/achievement-category',
      message: 'Failed to fetch achievement categories',
      query_scope: request.nextUrl.searchParams.get('scope') || 'all',
    });
    
    return NextResponse.json({ errorId, error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
