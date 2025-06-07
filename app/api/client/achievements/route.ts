import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  try {
    await connectToDatabase();

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      logError(new Error('Invalid or missing client ID'), {
        endpoint: 'GET /api/client/achievements',
        task: 'Fetching a clients configured achievements and rewards'
      });

      return NextResponse.json({ error: 'Invalid or missing clientId' }, { status: 400 });
    }

    const client = await Client.findById(clientId)
    .populate('achievements')
    .populate("rewardsPerAchievement");

    if (!client) {
      logError(new Error('Client not found'), {
        endpoint: 'GET /api/client/achievements',
        task: 'Fetching a clients configured achievements and rewards'
      });

      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      achievements: client.achievements,
      rewardsPerAchievement: Object.fromEntries(client.rewardsPerAchievement.entries()),
    });
  } catch (error) {
    logError(error, {
      message: `Error fetching client achievements & rewards for ClientId: ${clientId}`,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
