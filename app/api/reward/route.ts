import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

/**
 * Validates the reward data based on its product type.
 * @param body - The request body containing reward data.
 * @returns An error message string if invalid, or null if valid.
 */
function validateRewardBody(body: Partial<IReward>): string | null {
  const { product, name, category, discount, type, friendlyName } = body;

  // Rule 1: 'product', 'name', and 'category' are always required.
  if (!product || !name || !category) {
    return 'Missing required fields: product, name, and category are always required.';
  }

  // Rule 2: If the product is NOT 'custom', then discount details are required.
  if (product !== 'custom') {
    if (discount === undefined || discount === null || !type || !friendlyName) {
      return 'Missing required fields for standard reward: discount, type, and friendlyName are required.';
    }
  }
  
  // If all checks pass, the data is valid.
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectToDatabase();
    const body = await req.json() as Partial<IReward>;

    // Use the helper for clean validation
    const validationError = validateRewardBody(body);
    if (validationError) {
      logError(new Error(validationError), { endpoint: 'POST /api/reward', task: 'Validating new reward' });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Build the payload explicitly to ensure no extra properties are saved
    const newReward = new Reward({
      product: body.product,
      productDescription: body.productDescription,
      name: body.name,
      friendlyName: body.friendlyName,
      category: body.category,
      discount: body.discount,
      type: body.type,
      maxDiscount: body.maxDiscount,
      minimumSpend: body.minimumSpend,
    });
    
    await newReward.save();
    return NextResponse.json({ message: 'Reward created', reward: newReward }, { status: 201 });

  } catch (error) {
    logError(error, { message: 'Error creating new reward' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectToDatabase();
    
    const body = await req.json();
    const { id, ...updateData } = body as Partial<IReward> & { id: string };

    if (!id) return NextResponse.json({ error: 'Missing reward ID' }, { status: 400 });

    // Use the same helper for clean validation
    const validationError = validateRewardBody(updateData);
    if (validationError) {
      logError(new Error(validationError), { endpoint: 'PATCH /api/reward', task: 'Validating reward update' });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Build the update payload with $set and $unset for data integrity
    const updatePayload: { $set: Partial<IReward>, $unset?: Record<string, number> } = {
      $set: {
        product: updateData.product,
        productDescription: updateData.productDescription,
        name: updateData.name,
        friendlyName: updateData.friendlyName,
        category: updateData.category,
        maxDiscount: updateData.maxDiscount,
        minimumSpend: updateData.minimumSpend,
      }
    };

    if (updateData.product === 'custom') {
      // If it's custom, explicitly remove discount fields from the database document
      updatePayload.$unset = { discount: 1, type: 1 };
    } else {
      // If it's a standard reward, set the discount fields
      updatePayload.$set.discount = updateData.discount;
      updatePayload.$set.type = updateData.type;
    }

    const updatedReward = await Reward.findByIdAndUpdate(id, updatePayload, { new: true });

    if (!updatedReward) return NextResponse.json({ error: 'Reward not found' }, { status: 404 });

    return NextResponse.json({ message: 'Reward updated', reward: updatedReward });
  } catch (error) {
    logError(error, { message: `Error updating reward` });
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

