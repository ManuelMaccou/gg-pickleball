import connectToDatabase from '@/lib/mongodb'
import RewardCode from '@/app/models/RewardCode'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/sentry/logger'
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser'
import { IRewardCode } from '@/app/types/databaseTypes'
import { createRewardCodeInDB } from '@/lib/rewards/createRewardCodeInDB'
import { startSession } from 'mongoose'

export async function GET(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const clientId = searchParams.get('clientId')

  try {
    await connectToDatabase()

    if (!userId || !clientId) {
      logError(new Error("Missing userId or clientId."), {
        endpoint: 'GET /api/reward-code',
        task: 'Getting a reward code.'
      });

      return NextResponse.json({ error: 'Missing userId or clientId' }, { status: 400 })
    }

    const response = await RewardCode.find({
      userId,
      clientId,
      isGlobalReward: { $ne: true }
    })
    .populate({ 
      path: 'achievementId',
      model: 'Achievement',
    })

    const codes = response.map(code => ({
      ...code.toObject(),
      achievement: code.achievementId,
    }));

    return NextResponse.json({ codes })
  } catch (error) {
    const errorId = logError(error, {
      message: `Error fetching reward codes`,
      userId: userId,
      clientId: clientId,
      endpoint: 'GET /api/reward-code' 
    });

    return NextResponse.json({ errorId, error: 'There was an unexpected error. Please try again.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    const body: Partial<IRewardCode> = await req.json();

    const savedRewardCode = await createRewardCodeInDB(body, {session});

    await session.commitTransaction();

    return NextResponse.json(savedRewardCode, { status: 201 });
  } catch (error: unknown) {
    await session.abortTransaction();

    // FIX: Safely check if the error is an Error object and inspect its message
    if (error instanceof Error && error.message.includes('Missing required fields')) {
       const errorId = logError(error, { endpoint: 'POST /api/reward-code' });
       return NextResponse.json({ errorId, error: 'Missing required fields for reward code.' }, { status: 400 });
    }

    const errorId = logError(error, { 
      endpoint: 'POST /api/reward-code',
      task: 'Creating a reward code.'
    });
    return NextResponse.json(
      { errorId, error: 'An unexpected error happened. Please try again.' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}