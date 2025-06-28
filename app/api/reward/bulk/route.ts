import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { IReward } from '@/app/types/databaseTypes';
import Reward from '@/app/models/Reward';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase();

    const body = await req.json();

    if (!Array.isArray(body)) {
      logError(new Error('Expected the body to be an array of rewards'), {
        endpoint: 'POST /api/reward/bulk',
        task: 'Creating new rewards in bulk'
      });

      return NextResponse.json({ error: 'Expected an array of rewards' }, { status: 400 });
    }

    const invalid = body.find(
      (r: Partial<IReward>) => !r.name || !r.friendlyName || !r.product
    );

    if (invalid) {
      logError(new Error('All rewards must have name, friendlyName, and product'), {
        endpoint: 'POST /api/reward/bulk',
        task: 'Creating new rewards in bulk'
      });

      return NextResponse.json({ error: 'All rewards must have name, friendlyName, and product' }, { status: 400 });
    }

    const inserted = await Reward.insertMany(body);

    return NextResponse.json({ message: 'Bulk rewards created', inserted }, { status: 201 });
  } catch (error) {
    logError(error, {
      message: `Error creating rewards in bulk`,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
