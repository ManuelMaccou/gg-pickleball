import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  // 1. Authorization: Ensure only a superAdmin can access this list.
  const authorizedUser = await getAuthorizedUser(req);
  if (authorizedUser?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    const achievements = await Achievement.find({})
      .sort({ index: 'asc', friendlyName: 'asc' });

    return NextResponse.json({ achievements });

  } catch (error) {
    logError(error, { message: 'Failed to fetch all achievements for GGP Admin' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}