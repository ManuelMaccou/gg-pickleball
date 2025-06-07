import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import { IAchievement } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    if (!Array.isArray(body)) {
      logError(new Error('Request body was not an array of achievements.'), {
        endpoint: 'POST /api/achievement/bulk',
        task: 'Creating bulk achievemnts'
      });

      return NextResponse.json({ error: 'Expected an array of achievements' }, { status: 400 });
    }

    const invalid = body.find(
      (a: Partial<IAchievement>) => !a.name || !a.friendlyName || !a.badge
    );

    if (invalid) {
      logError(new Error('Request body did not include either name or badge.'), {
        endpoint: 'POST /api/achievement/bulk',
        task: 'Creating bulk achievemnts'
      });
      
      return NextResponse.json({ error: 'All achievements must have name, friendlyName, and badge' }, { status: 400 });
    }

    const inserted = await Achievement.insertMany(body);

    return NextResponse.json({ message: 'Bulk achievements created', inserted }, { status: 201 });
  } catch (error) {
      logError(error, {
        message: 'Failed to add achievements in bulk',
      });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
