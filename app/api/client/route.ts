import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { IClient } from '@/app/types/databaseTypes';
import { Types } from 'mongoose'
import { populateMapField } from '@/utils/populateMapField';
import Reward from '@/app/models/Reward';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { name, logo, latitude, longitude, achievements, rewardsPerAchievement } = body as Partial<IClient> & { name: string };

    if (!name) {
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
    console.error('[POST /api/client] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('id');

    if (clientId) {
      if (!Types.ObjectId.isValid(clientId)) {
        return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
      }

      const client = await Client.findById(clientId);
      if (!client) {
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
    console.error('Failed to fetch client(s):', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { clientId, achievements, rewardsPerAchievement } = body;

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Invalid or missing client ID' }, { status: 400 });
    }

    const client = await Client.findById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (achievements) {
      client.achievements = achievements; // should be array of ObjectId strings
    }

    if (rewardsPerAchievement) {
      // Important: rewardsPerAchievement must be an object { achievementKey: rewardId }
      client.rewardsPerAchievement = new Map(Object.entries(rewardsPerAchievement));
    }

    await client.save();

    return NextResponse.json({ message: 'Client updated successfully', client });
  } catch (error) {
    console.error('[PATCH /api/client] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
