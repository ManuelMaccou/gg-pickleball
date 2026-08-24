import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import Reward from '@/app/models/Reward';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { IAchievement, IClient, IReward, ISourceRewardConfig } from '@/app/types/databaseTypes';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const sourceConfigs = await SourceRewardConfig.find({}).lean<ISourceRewardConfig[]>();

    if (sourceConfigs.length === 0) {
      return NextResponse.json({ rewards: [] });
    }

    const achievementNames = sourceConfigs.map(config => config.achievementName);
    const allSponsorships = sourceConfigs.flatMap(config => config.sponsorships);

    const uniqueRewardIds = [...new Set(allSponsorships.map(s => s.rewardId))];
    const uniqueClientIds = [...new Set(allSponsorships.map(s => s.sponsoringClientId))];

    const [achievements, rewards, clients] = await Promise.all([
      Achievement.find({ name: { $in: achievementNames } }).lean<IAchievement[]>(),
      Reward.find({ _id: { $in: uniqueRewardIds } }).lean<IReward[]>(),
      Client.find({ _id: { $in: uniqueClientIds } })
        .select('name icon logo cardBackgroundImage cardTextColor shopify retailSoftware affiliateCode cardBackgroundPosition')
        .lean<Pick<IClient, '_id' | 'name' | 'icon' | 'logo' | 'cardBackgroundImage' | 'cardTextColor' | 'cardBackgroundPosition'>[]>(),
      ]);

    const achievementsByName = new Map(achievements.map(a => [a.name, a]));
    const rewardsById = new Map(rewards.map(r => [r._id.toString(), r]));
    const clientsById = new Map(
      clients
        .filter((c: any) => c.affiliateCode || (c.retailSoftware === 'shopify' && c.shopify?.accessToken))
        .map(c => [c._id.toString(), c])
    );

    const finalRewards = sourceConfigs.flatMap(config => {
      const achievement = achievementsByName.get(config.achievementName);
      if (!achievement) return [];

      return config.sponsorships.map(sponsorship => {
        const reward = rewardsById.get(sponsorship.rewardId.toString());
        const sponsoringClient = clientsById.get(sponsorship.sponsoringClientId.toString());

        if (!reward || !sponsoringClient) {
          return null;
        }

        return {
          achievement: {
            _id: achievement._id.toString(),
            name: achievement.name,
            friendlyName: achievement.friendlyName,
            task: achievement.task,
          },
          reward: reward,
          sponsoringClient: sponsoringClient,
        };
      }).filter(Boolean);
    });

    return NextResponse.json({ rewards: finalRewards });

  } catch (error) {
    const errorId = logError(error, {
      message: 'Failed to fetch source reward configurations',
      endpoint: 'GET /api/source-reward-config'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);

    if (authorizedUser?.permission !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { achievementName, sponsorship } = await req.json();

    if (!achievementName || !sponsorship) {
      return NextResponse.json({ error: 'Missing required fields: achievementName and sponsorship are required.' }, { status: 400 });
    }

    const { sponsoringClientId, rewardId } = sponsorship;
    if (!sponsoringClientId || !rewardId || !Types.ObjectId.isValid(sponsoringClientId) || !Types.ObjectId.isValid(rewardId)) {
      return NextResponse.json({ error: 'Invalid or missing IDs in request body.' }, { status: 400 });
    }

    await connectToDatabase();

    // [Program pivot] Upsert key is now just achievementName — there is
    // exactly one SourceRewardConfig per achievement, globally, enforced
    // by the unique index on the schema.
    const updatedConfig = await SourceRewardConfig.findOneAndUpdate(
      { achievementName },
      {
        $push: { sponsorships: {
          sponsoringClientId: sponsorship.sponsoringClientId,
          rewardId: sponsorship.rewardId
        }}
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    await Client.findByIdAndUpdate(sponsorship.sponsoringClientId, {
      needsRetroactiveSweep: true
    });

    return NextResponse.json({ sourceRewardConfig: updatedConfig }, { status: 200 });

   } catch (error: unknown) {
    const errorId = logError(error, {
      message: 'Failed to create or update SourceRewardConfig',
      endpoint: 'POST /api/source-reward-config'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (authorizedUser?.permission !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { achievementName, rewardId } = await req.json();

    if (!achievementName || !rewardId) {
      return NextResponse.json({ error: 'Missing required fields: achievementName and rewardId are required.' }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(rewardId)) {
      return NextResponse.json({ error: 'Invalid ObjectId format provided.' }, { status: 400 });
    }

    await connectToDatabase();

    const updatedConfigPromise = SourceRewardConfig.findOneAndUpdate(
      { achievementName },
      { $pull: { sponsorships: { rewardId: rewardId } } },
      { new: true }
    );

    const deleteRewardPromise = Reward.findByIdAndDelete(rewardId);

    const [updatedConfig] = await Promise.all([
      updatedConfigPromise,
      deleteRewardPromise
    ]);

    return NextResponse.json({
      message: 'Sponsorship and reward removed successfully.',
      config: updatedConfig
    }, { status: 200 });

  } catch (error: unknown) {
    const errorId = logError(error, {
      message: 'Failed to remove source reward sponsorship',
      endpoint: 'DELETE /api/source-reward-config'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}