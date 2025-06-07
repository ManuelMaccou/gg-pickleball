import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { discount, product, name, type, friendlyName, category } = body as IReward;

    if (!discount || !product || !name || !type || !friendlyName || !category) {
      logError(new Error('Required fields are missing.'), {
        endpoint: 'POST /api/reward',
        task: 'Creating a new reward'
      });

      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    const newReward = new Reward({ discount, product, name, type, friendlyName, category });
    await newReward.save();

    return NextResponse.json({ message: 'Reward created', reward: newReward }, { status: 201 });
  } catch (error) {
    logError(error, {
      message: `Error creating new reward`,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase()
    const rewards = await Reward.find()
    return NextResponse.json({ rewards })
  } catch (error) {
    logError(error, {
      message: `Error fetching all rewards`,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
