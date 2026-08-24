import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Reward from '@/app/models/Reward';
import { IReward } from '@/app/types/databaseTypes';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

/**
 * Validates the reward data based on its product type and discount kind.
 * @param body - The request body containing reward data.
 * @returns An error message string if invalid, or null if valid.
 */
function validateRewardBody(body: Partial<IReward>): string | null {
  const { product, name, category, friendlyName, discountKind, discount, type, bxgy } = body;

  // Rule 1: 'product', 'name', and 'category' are always required.
  if (!product || !name || !category) {
    return 'Missing required fields: product, name, and category are always required.';
  }

  // Rule 2: 'custom' products carry no discount mechanics at all — unchanged.
  if (product === 'custom') {
    return null;
  }

  // Rule 3: Buy X, get Y — no top-level discount/type; validate the bxgy shape instead.
  if (discountKind === 'bxgy') {
    if (!friendlyName) {
      return 'Missing required field: friendlyName is required.';
    }
    if (!bxgy || !bxgy.buys || !bxgy.gets || !bxgy.buyQuantity || !bxgy.getQuantity || !bxgy.getPercent) {
      return 'Missing required fields for a Buy X, get Y reward: buys, gets, buyQuantity, getQuantity, and getPercent are all required.';
    }
    const buysEmpty = (bxgy.buys.products?.length ?? 0) === 0 && (bxgy.buys.collections?.length ?? 0) === 0;
    const getsEmpty = (bxgy.gets.products?.length ?? 0) === 0 && (bxgy.gets.collections?.length ?? 0) === 0;
    if (buysEmpty) return 'Choose at least one product or collection for "Customer buys."';
    if (getsEmpty) return 'Choose at least one product or collection for "Customer gets."';
    return null;
  }

  // Rule 4: Amount off (default — includes legacy rewards with no discountKind at all).
  if (discount === undefined || discount === null || !type || !friendlyName) {
    return 'Missing required fields for standard reward: discount, type, and friendlyName are required.';
  }

  return null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req);

  if (user?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const body = await req.json() as Partial<IReward>;

    const validationError = validateRewardBody(body);
    if (validationError) {
      logError(new Error(validationError), { endpoint: 'POST /api/reward', task: 'Validating new reward' });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Build the payload explicitly to ensure no extra properties are saved.
    // Undefined fields (e.g. bxgy on an amount-off reward) are simply never
    // set on the fresh document — no $unset concern on create.
    const newReward = new Reward({
      product: body.product,
      productDescription: body.productDescription,
      name: body.name,
      friendlyName: body.friendlyName,
      category: body.category,
      discount: body.discount,
      type: body.type,
      minimumSpend: body.minimumSpend,
      discountKind: body.discountKind,
      shopifyTargeting: body.shopifyTargeting,
      bxgy: body.bxgy,
      combinesWithOtherDiscounts: body.combinesWithOtherDiscounts,
    });

    await newReward.save();
    return NextResponse.json({ message: 'Reward created', reward: newReward }, { status: 201 });

  } catch (error) {
    const errorId = logError(error, {
      message: 'Error creating new reward',
      endpoint: 'POST /api/reward'
    });
    return NextResponse.json({ errorId, error: 'There was an unexpected error. We are on it.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectToDatabase();

    const body = await req.json();
    const { id, ...updateData } = body as Partial<IReward> & { id: string };

    if (!id) {
      logError(new Error("Missing id."), {
        endpoint: 'POST /api/reward',
        task: 'Updating a reward.'
      });

      return NextResponse.json({ error: 'There was an error. Please try again.' }, { status: 400 });
    }

    const validationError = validateRewardBody(updateData);
    if (validationError) {
      logError(new Error(validationError), { endpoint: 'PATCH /api/reward', task: 'Validating reward update' });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Build the update payload with $set and $unset for data integrity.
    // Three mutually exclusive shapes now, not two: 'custom' (no discount
    // mechanics), 'bxgy' (no top-level discount/type/minimumSpend/scope),
    // and amount-off (today's existing shape). Each branch unsets exactly
    // what the OTHER shapes would have left behind from a prior edit —
    // same pattern the 'custom' branch already used for discount/type.
    const updatePayload: { $set: Partial<IReward>; $unset?: Record<string, number> } = {
      $set: {
        product: updateData.product,
        productDescription: updateData.productDescription,
        name: updateData.name,
        friendlyName: updateData.friendlyName,
        category: updateData.category,
        minimumSpend: updateData.minimumSpend,
        discount: updateData.discount,
        type: updateData.type,
        discountKind: updateData.discountKind,
        shopifyTargeting: updateData.shopifyTargeting,
        bxgy: updateData.bxgy,
        combinesWithOtherDiscounts: updateData.combinesWithOtherDiscounts,
      }
    };

    if (updateData.product === 'custom') {
      // Unchanged from before: a non-monetary reward carries no discount
      // fields of any kind, amount or bxgy.
      updatePayload.$set.minimumSpend = updateData.minimumSpend;
      updatePayload.$unset = { discount: 1, type: 1, discountKind: 1, shopifyTargeting: 1, bxgy: 1 };
    } else if (updateData.discountKind === 'bxgy') {
      updatePayload.$set.discountKind = 'bxgy';
      updatePayload.$set.bxgy = updateData.bxgy;
      updatePayload.$unset = { discount: 1, type: 1, minimumSpend: 1, shopifyTargeting: 1 };
    } else {
      updatePayload.$set.discount = updateData.discount;
      updatePayload.$set.type = updateData.type;
      updatePayload.$set.minimumSpend = updateData.minimumSpend;
      updatePayload.$set.discountKind = updateData.discountKind ?? 'amount';
      updatePayload.$set.shopifyTargeting = updateData.shopifyTargeting;
      updatePayload.$unset = { bxgy: 1 };
    }

    const updatedReward = await Reward.findByIdAndUpdate(id, updatePayload, { new: true });

    if (!updatedReward) {
      logError(new Error(`reward not found for id: ${id}.`), {
        endpoint: 'POST /api/reward',
        task: 'Updating a reward.'
      });

      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reward updated', reward: updatedReward });
  } catch (error) {
    const errorId = logError(error, {
      message: `Error updating reward`,
      endpoint: 'PATCH /api/reward'
    });
    return NextResponse.json({ errorId, error: 'Internal server error' }, { status: 500 });
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
      logError(new Error("Missing rward Id."), {
        endpoint: 'POST /api/reward',
        task: 'Deleting a reward.'
      });
      return NextResponse.json({ error: 'Missing reward ID' }, { status: 400 });
    }

    const deletedReward = await Reward.findByIdAndDelete(rewardId);

    if (!deletedReward) {
      logError(new Error("Reward not found."), {
        endpoint: 'POST /api/reward',
        task: 'Deleting a reward.'
      });
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reward deleted successfully' });
  } catch (error) {

    const errorId = logError(error, {
       message: 'Error deleting reward',
       endpoint: 'DELETE /api/reward'
      });
    return NextResponse.json({ errorId, error: 'There as an error deleting the reward. Please try again.' }, { status: 500 });
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

    const errorId = logError(error, {
       message: `Error fetching reward(s)`,
       endpoint: 'UNKNOWN /api/reward'
      });
    return NextResponse.json({ errorId, error: 'There was an error fetching reward details. Please try again.' }, { status: 500 });
  }
}