import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';
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

    const { discount, product, name, type, maxDiscount, minimumSpend, friendlyName, category } = body as IReward;

    if (!discount || !product || !name || !type || !friendlyName || !category) {
      logError(new Error('Required fields are missing.'), {
        endpoint: 'POST /api/reward',
        task: 'Creating a new reward'
      });

      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    const newReward = new Reward({ discount, product, name, type, maxDiscount, minimumSpend, friendlyName, category });
    await newReward.save();

    return NextResponse.json({ message: 'Reward created', reward: newReward }, { status: 201 });
  } catch (error) {
    logError(error, {
      message: `Error creating new reward`,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing reward ID' }, { status: 400 });
    }

    const body = await req.json();
    const { discount, product, name, type, maxDiscount, minimumSpend, friendlyName, category } = body as IReward;

    if (!discount || !product || !name || !type || !friendlyName || !category) {
      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    const updatedReward = await Reward.findByIdAndUpdate(
      id,
      { discount, product, name, type,  maxDiscount, minimumSpend, friendlyName, category },
      { new: true } // return the updated document
    );

    if (!updatedReward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reward updated', reward: updatedReward });
  } catch (error) {
    logError(error, {
      message: `Error updating reward`,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase();
    const rewardId = req.nextUrl.searchParams.get('id');

    if (!rewardId) {
      return NextResponse.json({ error: 'Missing reward ID' }, { status: 400 });
    }

    const deletedReward = await Reward.findByIdAndDelete(rewardId);

    if (!deletedReward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reward deleted successfully' });
  } catch (error) {
    logError(error, {
      message: 'Error deleting reward',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const rewardId = searchParams.get('id');

    if (rewardId) {
      const reward = await Reward.findById(rewardId);
      if (!reward) {
        return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
      }
      return NextResponse.json({ reward });
    }

    // Fallback to return all rewards
    const rewards = await Reward.find();
    return NextResponse.json({ rewards });
  } catch (error) {
    logError(error, {
      message: `Error fetching reward(s)`,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

