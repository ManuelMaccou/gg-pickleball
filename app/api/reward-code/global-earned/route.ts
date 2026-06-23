import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import RewardCode from '@/app/models/RewardCode';
import { IRewardCode } from '@/app/types/databaseTypes';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const dataSourceId = searchParams.get('dataSourceId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!dataSourceId || !Types.ObjectId.isValid(dataSourceId)) {
    return NextResponse.json({ error: 'Valid dataSourceId is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const codes = await RewardCode.find({
      userId,
      dataSourceId: new Types.ObjectId(dataSourceId)
    })
      .populate('reward') // This populate is likely not needed if reward is embedded
      .populate({ 
        path: 'achievementId',
        model: 'Achievement',
        select: 'name friendlyName task'
      })
      .populate({
        path: 'clientId',
        model: 'Client',
        select: 'name icon logo shopify'
      })
      .lean();

    return NextResponse.json({ codes });

  } catch (error) {
    console.error('Error fetching source-specific earned rewards:', error);
    const errorId = logError(error, { endpoint: 'GET /api/reward-code/global-earned' });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}
