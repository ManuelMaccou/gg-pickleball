import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { discount, product, name, type, friendlyName, category } = body as IReward;

    if (!discount || !product || !name || !type || !friendlyName || !category) {
      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    const newReward = new Reward({ discount, product, name, type, friendlyName, category });
    await newReward.save();

    return NextResponse.json({ message: 'Reward created', reward: newReward }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/reward] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase()
    const rewards = await Reward.find()
    return NextResponse.json({ rewards })
  } catch (error) {
    console.error('Failed to fetch rewards:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
