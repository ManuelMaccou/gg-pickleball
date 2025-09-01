import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import RewardCode from '@/app/models/RewardCode';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');

    if (!locationId || !Types.ObjectId.isValid(locationId)) {
      return NextResponse.json({ error: 'Valid locationId is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Fetch all reward codes for the specified location
    const rewardCodes = await RewardCode.find({ clientId: new Types.ObjectId(locationId) })
      .sort({ createdAt: -1 }) // Sort by most recent
      .lean(); // Use .lean() for faster, plain JSON objects

    return NextResponse.json({ rewardCodes });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error fetching reward codes by location:', message);

    logError(new Error(`Internal server error: ${message}.`), {
      endpoint: 'GET /api/reward-code/location',
      task: 'Getting a reward code by location.',
    });
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}