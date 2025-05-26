import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { IReward } from '@/app/types/databaseTypes';
import Reward from '@/app/models/Reward';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an array of rewards' }, { status: 400 });
    }

    const invalid = body.find(
      (r: Partial<IReward>) => !r.name || !r.friendlyName || !r.product
    );

    if (invalid) {
      return NextResponse.json({ error: 'All rewards must have name, friendlyName, and product' }, { status: 400 });
    }

    const inserted = await Reward.insertMany(body);

    return NextResponse.json({ message: 'Bulk rewards created', inserted }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/reward/bulk] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
