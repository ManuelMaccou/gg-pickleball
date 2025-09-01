import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose'
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await connectToDatabase();

    // Use a type that matches the incoming body from your form
    const body = await req.json();

    const { name } = body;

    // Only the name is truly required to create a client
    if (!name) {
      logError(new Error('Request body did not include required field: name'), {
        endpoint: 'POST /api/client',
        task: 'Creating a client'
      });
      return NextResponse.json({ error: 'There was an error creating the client. Please try again ensuring all fields are included.' }, { status: 400 });
    }

    // Pass the entire body to the new Client constructor.
    // Mongoose will only use the fields defined in its schema.
    const newClient = new Client(body);

    await newClient.save();

    return NextResponse.json({ message: 'Client created', client: newClient }, { status: 201 });
  } catch (error: unknown) {
    // Check for MongoDB duplicate key error
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      logError(error, { message: 'Attempted to create a client with a duplicate name.' });

      return NextResponse.json({ error: 'A client with this name already exists.' }, { status: 409 });
    }

    logError(error, { message: 'Error creating Client.' });
    return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('id');

  try {
    await connectToDatabase();

    if (clientId) {
      if (!Types.ObjectId.isValid(clientId)) {
        logError(new Error('Client ID was not in the right format'), {
          endpoint: 'GET /api/client',
          task: 'Fetching a client'
        });

        return NextResponse.json({ error: 'There was an error whil fetching the data. Please try again.' }, { status: 400 });
      }

       const client = await Client.findById(clientId)
        .populate('achievements')
        .populate('altAchievements')
        .populate('rewardsPerAchievement')
        .populate('altRewardsPerAchievement');

      if (!client) {
        logError(new Error('Client was not found'), {
          endpoint: 'GET /api/client',
          task: 'Fetching a client'
        });

        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      return NextResponse.json({ client });
    }

    // No ID? Return all clients
   const clients = await Client.find()
      .populate('achievements')
      .populate('altAchievements')
      .populate('rewardsPerAchievement')
      .populate('altRewardsPerAchievement');

    return NextResponse.json({ clients });
  } catch (error) {
    logError(error, {
      message: clientId ? `Failed to fetch client with clientId: ${clientId}` : 'Failed to fetch all clients',
      clientId: clientId ?? 'null'
    });
    return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let clientId: string | undefined;

  try {
    await connectToDatabase();

    const {
      clientId: bodyClientId,
      achievements,
      rewardsPerAchievement,
      removeRewardForAchievement,
      rewardConfigStatus,
      rewardContext = 'default',
      achievementContext = 'default',
      mergeRewards = false,
    }: {
      clientId?: string;
      achievements?: string[];
      rewardsPerAchievement?: Record<string, string>;
      removeRewardForAchievement?: string[];
      rewardConfigStatus?: 'active';
      rewardContext?: 'default' | 'alt';
      achievementContext?: 'default' | 'alt';
      mergeRewards?: boolean;
    } = await req.json();

     clientId = bodyClientId;

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      logError(new Error('Invalid or missing client ID'), {
        endpoint: 'PATCH /api/client',
        task: 'Updating a client'
      });

      return NextResponse.json({ error: 'There was an error updating the client information. Please try again.' }, { status: 400 });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      logError(new Error('Client not found'), {
        endpoint: 'PATCH /api/client',
        task: 'Updating a client'
      });

      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const removedRewardIds: string[] = [];

    if (rewardConfigStatus === 'active') {
      client.rewardConfigStatus = 'active';
    }

    if (achievementContext === 'alt' || rewardContext === 'alt') {
      client.rewardConfigStatus = 'pending'
    }

    const achievementFieldKey =
      achievementContext === 'alt' ? 'altAchievements' : 'achievements';

    if (achievements) {
      client[achievementFieldKey] = achievements;
    }

    const rewardFieldKey =
      rewardContext === 'alt' ? 'altRewardsPerAchievement' : 'rewardsPerAchievement';

    if (Array.isArray(removeRewardForAchievement)) {
      for (const achievementKey of removeRewardForAchievement) {
        const rewardId = client[rewardFieldKey]?.get(achievementKey);
        if (rewardId) {
          removedRewardIds.push(rewardId.toString());
        }
        client[rewardFieldKey]?.delete(achievementKey);
      }
    }

    // ✅ PARTIAL REMOVE of specific reward entries
    if (Array.isArray(removeRewardForAchievement)) {
      for (const achievementKey of removeRewardForAchievement) {
        const rewardId = client[rewardFieldKey]?.get(achievementKey);
        if (rewardId) {
          removedRewardIds.push(rewardId.toString());
        }
        client[rewardFieldKey]?.delete(achievementKey);
      }
    }

    if (rewardsPerAchievement) {
      if (!mergeRewards) {
        client[rewardFieldKey]?.clear(); // full replacement (default)
      }

      for (const [achievementKey, rewardId] of Object.entries(rewardsPerAchievement)) {
        if (Types.ObjectId.isValid(rewardId)) {
          client[rewardFieldKey]?.set(achievementKey, new Types.ObjectId(rewardId));
        } else {
          console.warn(`Invalid rewardId for achievement "${achievementKey}": ${rewardId}`);
        }
      }
    }

    await client.save();
    await client.populate(achievementContext === 'alt' ? 'altAchievements' : 'achievements');

    return NextResponse.json({
      message: 'Client updated successfully',
      client,
      removedRewardIds,
    });
  } catch (error) {
    logError(error, {
      message: `Failed to update client achievements for clientId: ${clientId}`,
    });
    
    return NextResponse.json({ error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}
