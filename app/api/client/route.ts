import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { IClient } from '@/app/types/databaseTypes';
import { Types } from 'mongoose'
import { populateMapField } from '@/utils/populateMapField';
import Reward from '@/app/models/Reward';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { name, logo, latitude, longitude, achievements, rewardsPerAchievement } = body as Partial<IClient> & { name: string };

    if (!name) {
      logError(new Error('Request body did not include name'), {
        endpoint: 'POST /api/client',
        task: 'Creating a client'
      });

      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newClient = new Client({
      name,
      logo,
      latitude,
      longitude,
      achievements: achievements || [],
      rewardsPerAchievement: rewardsPerAchievement
        ? new Map(Object.entries(rewardsPerAchievement))
        : new Map(),
    });

    await newClient.save();

    return NextResponse.json({ message: 'Client created', client: newClient }, { status: 201 });
  } catch (error) {
    logError(error, {
      message: 'Error creating Client.'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

        return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
      }

      const client = await Client.findById(clientId);
      if (!client) {
        logError(new Error('Client was not found'), {
          endpoint: 'GET /api/client',
          task: 'Fetching a client'
        });

        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      const populatedRewards = await populateMapField(
        client.rewardsPerAchievement,
        async (ids) => Reward.find({ _id: { $in: ids } })
      );

      const clientObj = client.toObject();
      clientObj.rewardsPerAchievement = populatedRewards;

      return NextResponse.json({ client: clientObj });
    }

    // No ID? Return all clients
    const clients = await Client.find();
    return NextResponse.json({ clients });
  } catch (error) {
    logError(error, {
      message: clientId ? `Failed to fetch client with clientId: ${clientId}` : 'Failed to fetch all clients',
      clientId: clientId ?? 'null'
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let clientId: string | undefined,
    achievements: string[] | undefined,
    rewardsPerAchievement: Record<string, string> | undefined,
    removeRewardForAchievement: string[] | undefined;


  try {
    await connectToDatabase();

    const body = await req.json();

    clientId = body.clientId;
    achievements = body.achievements;
    rewardsPerAchievement = body.rewardsPerAchievement;
    removeRewardForAchievement = body.removeRewardForAchievement;

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      logError(new Error('Invalid or missing client ID'), {
        endpoint: 'PATCH /api/client',
        task: 'Updating a client'
      });

      return NextResponse.json({ error: 'Invalid or missing client ID' }, { status: 400 });
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

    if (achievements) {
      client.achievements = achievements;
    }

    if (Array.isArray(removeRewardForAchievement)) {
      for (const achievementKey of removeRewardForAchievement) {
        const rewardId = client.rewardsPerAchievement.get(achievementKey);
        if (rewardId) {
          removedRewardIds.push(rewardId.toString());
        }
        client.rewardsPerAchievement.delete(achievementKey);
      }
    }

    if (rewardsPerAchievement) {
      for (const [achievementKey, rewardId] of Object.entries(rewardsPerAchievement)) {
        if (Types.ObjectId.isValid(rewardId)) {
          client.rewardsPerAchievement.set(achievementKey, new Types.ObjectId(rewardId));
        } else {
          console.warn(`Invalid rewardId for achievement "${achievementKey}": ${rewardId}`);
        }
      }
    }

    await client.save();
    await client.populate('achievements');

    return NextResponse.json({
      message: 'Client updated successfully',
      client,
      removedRewardIds,
    });
  } catch (error) {
    logError(error, {
      message: `Failed to update client achievements for clientId: ${clientId}`,
    });
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
