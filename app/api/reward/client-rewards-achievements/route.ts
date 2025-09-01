import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Client from '@/app/models/Client'
import Reward from '@/app/models/Reward'
import Achievement from '@/app/models/Achievement'
import { Types } from 'mongoose'
import { logError } from '@/lib/sentry/logger'
import { achievementKeyToFunctionName } from '@/lib/achievements/definitions'
import { achievementFunctionMetadata } from '@/lib/achievements/achievementMetadata'
import { IAchievement, IReward } from '@/app/types/databaseTypes'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  try {
    await connectToDatabase()

    if (!clientId) {
      logError(new Error("Missing clientId."), {
        endpoint: 'POST /api/reward/client-rewards-achievements',
        task: 'Getting a reward/achievement for a client.'
      });

      return NextResponse.json({ error: 'There was an error fetching client reward data.' }, { status: 400 })
    }

    const client = await Client.findById(clientId)

    if (!client) {
      logError(new Error(`Client not found for client ID: ${clientId}.`), {
        endpoint: 'POST /api/reward/client-rewards-achievements',
        task: 'Getting a reward/achievement for a client.'
      });

      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const rewardsPerAchievement = client.rewardsPerAchievement ?? new Map()
    const entries = Array.from(rewardsPerAchievement.entries()) as [string, Types.ObjectId][];

    if (entries.length === 0) {
      return NextResponse.json({ rewards: [] })
    }

    const rewardIds = entries.map(([, rewardId]) => rewardId)
    const achievementNames = entries.map(([achievementName]) => achievementName);

    const [rewards, achievements] = await Promise.all([
      Reward.find({ _id: { $in: rewardIds } }).lean<IReward[]>(),
      Achievement.find({ name: { $in: achievementNames } }).lean<IAchievement[]>(),
    ]);

    const result = entries.map(([achievementName, rewardId]) => {
      const reward = rewards.find(r => r._id.toString() === rewardId.toString());
      const achievement = achievements.find(a => a.name === achievementName);

      if (!reward || !achievement) return null;

      const functionName = achievementKeyToFunctionName[achievementName];
      const metadata = functionName ? achievementFunctionMetadata[functionName] : undefined;
      const isRepeatable = metadata ? metadata.repeatable : false;

      // Since `reward` is now a plain object, we can spread it directly.
      // The `.toObject()` call is no longer needed.
      return {
        achievementId: achievement._id.toString(),
        achievementFriendlyName: achievement.friendlyName,
        reward: {
          ...reward,
          repeatable: isRepeatable,
        },
      };
    }).filter(Boolean);

    return NextResponse.json({ rewards: result })
  } catch (error) {
    logError(error, {
      message: `Error fetching client's configured rewards`,
      clientId: clientId,
    });
    
    return NextResponse.json({ error: 'An unexpected error happened. Please try again.' }, { status: 500 })
  }
}
