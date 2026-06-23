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
    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get('dataSourceId');

    if (!dataSourceId || !Types.ObjectId.isValid(dataSourceId)) {
      return NextResponse.json({ error: 'Valid dataSourceId is required' }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Find all reward configurations for this data source.
    const sourceConfigs = await SourceRewardConfig.find({ 
      dataSourceId: new Types.ObjectId(dataSourceId) 
    }).lean<ISourceRewardConfig[]>();

    if (sourceConfigs.length === 0) {
      return NextResponse.json({ rewards: [] }); // No rewards configured for this source.
    }

    // 2. Gather all unique IDs needed for population.
    const achievementNames = sourceConfigs.map(config => config.achievementName);
    const allSponsorships = sourceConfigs.flatMap(config => config.sponsorships);
    
    // Using Set to ensure uniqueness, which is more efficient for the DB query.
    const uniqueRewardIds = [...new Set(allSponsorships.map(s => s.rewardId))];
    const uniqueClientIds = [...new Set(allSponsorships.map(s => s.sponsoringClientId))];

    // 3. Fetch all the necessary documents in parallel for performance.
    const [achievements, rewards, clients] = await Promise.all([
      Achievement.find({ name: { $in: achievementNames } }).lean<IAchievement[]>(),
      Reward.find({ _id: { $in: uniqueRewardIds } }).lean<IReward[]>(),
      Client.find({ _id: { $in: uniqueClientIds } })
        .select('name icon logo cardBackgroundImage cardTextColor shopify retailSoftware')
        .lean<Pick<IClient, '_id' | 'name' | 'icon' | 'logo' | 'cardBackgroundImage' | 'cardTextColor'>[]>(),
    ]);

    // 4. Create Maps for efficient lookups (O(1) access).
    const achievementsByName = new Map(achievements.map(a => [a.name, a]));
    const rewardsById = new Map(rewards.map(r => [r._id.toString(), r]));
    const clientsById = new Map(
      clients
        .filter((c: any) => c.retailSoftware === 'shopify' && c.shopify?.accessToken)
        .map(c => [c._id.toString(), c])
    );

    // 5. Stitch the data together into the format the frontend expects.
    const finalRewards = sourceConfigs.flatMap(config => {
      const achievement = achievementsByName.get(config.achievementName);
      if (!achievement) return []; // Skip if achievement data is missing

      return config.sponsorships.map(sponsorship => {
        const reward = rewardsById.get(sponsorship.rewardId.toString());
        const sponsoringClient = clientsById.get(sponsorship.sponsoringClientId.toString());

        // Ensure all parts exist before creating the final object
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
      }).filter(Boolean); // Filter out any null entries from missing data
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
    // 1. Authorization: Only admins can configure rewards.
    const authorizedUser = await getAuthorizedUser(req);
    console.log('authroriized user:', authorizedUser)

    if (authorizedUser?.permission !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 2. Get and Validate the Request Body
    const { dataSourceId, achievementName, sponsorship } = await req.json();

    if (!dataSourceId || !achievementName || !sponsorship) {
      return NextResponse.json({ error: 'Missing required fields: dataSourceId, achievementName, and sponsorship are required.' }, { status: 400 });
    }

    const { sponsoringClientId, rewardId } = sponsorship;
    if (!sponsoringClientId || !rewardId || !Types.ObjectId.isValid(sponsoringClientId) || !Types.ObjectId.isValid(rewardId) || !Types.ObjectId.isValid(dataSourceId)) {
      return NextResponse.json({ error: 'Invalid or missing IDs in request body.' }, { status: 400 });
    }

    await connectToDatabase();

    // 3. Find and Update Logic (Upsert)
    // This finds a document matching the dataSourceId and achievementName.
    // If found, it pushes the new sponsorship into the 'sponsorships' array.
    // If not found (upsert: true), it creates a new document with these fields.
    const updatedConfig = await SourceRewardConfig.findOneAndUpdate(
      { 
        dataSourceId: dataSourceId, // Pass the string directly
        achievementName: achievementName,
      },
      { 
        $push: { sponsorships: {
          sponsoringClientId: sponsorship.sponsoringClientId, // Pass the string directly
          rewardId: sponsorship.rewardId // Pass the string directly
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

    // 4. Respond with the updated/created document
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
    // 1. Authorization: Ensure only an admin can perform this action.
    const authorizedUser = await getAuthorizedUser(req);
    console.log('delete authorized user:', authorizedUser)
    if (authorizedUser?.permission !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 2. Get and Validate the Request Body
    const { dataSourceId, achievementName, rewardId } = await req.json();

    if (!dataSourceId || !achievementName || !rewardId) {
      return NextResponse.json({ error: 'Missing required fields: dataSourceId, achievementName, and rewardId are required.' }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(dataSourceId) || !Types.ObjectId.isValid(rewardId)) {
      return NextResponse.json({ error: 'Invalid ObjectId format provided.' }, { status: 400 });
    }

    await connectToDatabase();

    const updatedConfigPromise = SourceRewardConfig.findOneAndUpdate(
      {
        dataSourceId: dataSourceId,
        achievementName: achievementName
      },
      {
        $pull: { sponsorships: { rewardId: rewardId } }
      },
      { new: true } // Return the document after the update is applied
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
      message: 'Failed to remove source reward sponsorship' ,
      endpoint: 'DELETE /api/source-reward-config'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}