import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const achievementContext = searchParams.get('achievementContext');
  const rewardContext = searchParams.get('rewardContext');

  try {
    await connectToDatabase();

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      logError(new Error('Invalid or missing client ID'), {
        endpoint: 'GET /api/client/achievements',
        task: 'Fetching a clients configured achievements and rewards'
      });

      return NextResponse.json({ error: 'There was an error fetching client data. Please try again.' }, { status: 400 });
    }

    const achievementFieldKey =
      achievementContext === 'alt' ? 'altAchievements' : 'achievements';

    const rewardFieldKey =
      rewardContext === 'alt' ? 'altRewardsPerAchievement' : 'rewardsPerAchievement';

    const client = await Client.findById(clientId)
    .populate(achievementFieldKey)
    .populate(rewardFieldKey);

    if (!client) {
      logError(new Error('Client not found'), {
        endpoint: 'GET /api/client/achievements',
        task: 'Fetching a clients configured achievements and rewards'
      });

      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const rewardsMap = client[rewardFieldKey];
    const rewardsPerAchievement =
      rewardsMap instanceof Map ? Object.fromEntries(rewardsMap.entries()) : {};

    return NextResponse.json({
      achievements: client[achievementFieldKey],
      rewardsPerAchievement,
      rewardConfigStatus: client.rewardConfigStatus,
    });

  } catch (error) {
    logError(error, {
      message: `Error fetching client achievements & rewards for ClientId: ${clientId}`,
    });
    return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}
