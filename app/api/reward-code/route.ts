import connectToDatabase from '@/lib/mongodb'
import RewardCode from '@/app/models/RewardCode'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/sentry/logger'
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser'
import { IRewardCode } from '@/app/types/databaseTypes'

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

    const response = await RewardCode.find({ userId, clientId })
    .populate('achievementId')

    const codes = response.map(code => ({
      ...code.toObject(),
      achievement: code.achievementId,
    }));

    return NextResponse.json({ codes })
  } catch (error) {
    logError(error, {
      message: `Error fetching reward codes`,
      userId: userId,
      clientId: clientId,
    });

    return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body: Partial<IRewardCode> = await req.json();

    if (!body.code || !body.clientId || !body.achievementId || !body.reward) {
      logError(new Error("Missing required fields."), {
        endpoint: 'POST /api/reward-code',
        task: 'Creating a reward code.',
        clientId: body.clientId ?? "null",
        achievementId: body.achievementId ?? 'null',
        reward: body.reward ?? 'null'
      });

      return NextResponse.json(
        { error: 'There was an error creating a reward. Pleas try again.' },
        { status: 400 }
      );
    }

    const newRewardCode = new RewardCode({
      code: body.code,
      userId: body.userId,
      clientId: body.clientId,
      achievementId: body.achievementId,
      reward: body.reward,
      redeemed: body.redeemed ?? false,
      redemptionDate: body.redemptionDate ?? null,
      addedToPos: body.addedToPos
    });

    const savedRewardCode = await newRewardCode.save();

    return NextResponse.json(savedRewardCode, { status: 201 });
  } catch (error) {
    logError(new Error("Internal server error."), {
        endpoint: 'POST /api/reward-code',
        task: 'Creating a reward code.',
      });

    return NextResponse.json(
      { error: 'An unexpected error happened. Please try again.' },
      { status: 500 }
    );
  }
}
