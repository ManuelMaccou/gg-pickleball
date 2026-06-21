import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { escapeRegex } from '@/utils/escapeRegex';
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { subscribeToDuprWebhook } from '@/lib/services/dupr/duprWebhookSubscription';
import { checkEntitlementsWithToken } from '@/lib/services/dupr/duprEntitlement';

await connectToDatabase();

type DuprFields = {
  rating?: number;
  verified?: boolean;
};

type UserUpdatePayload = {
  name?: string;
  dupr?: DuprFields;
};

export async function POST(request: NextRequest) {

  const user = await getAuthorizedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let name: string | undefined,
    auth0Id: string | undefined;

  try {
    const body = await request.json();
    name = body.name;
    auth0Id = body.auth0Id

    if (!name || name.trim() === "") {
    logError(new Error(`Name is missing`), {
      endpoint: 'POST /api/user',
      task: 'Creating a user.',
    });

      return NextResponse.json({ error: 'Name is a required field' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const safeName = escapeRegex(trimmedName);

    const existingUser = await User.findOne({
      name: { $regex: `^${safeName}$`, $options: 'i' }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Name already exists. Choose a different name.' }, { status: 409 });
    }

    const newUser = new User({
      name: trimmedName,
      auth0Id,
    });

    await newUser.save();

    return NextResponse.json({ message: 'User created successfully', user: newUser }, { status: 201 });

  } catch (error) {
    const errorId = logError(error, {
      message: `Failed to save user.`,
      name: name ?? 'Undefined',
      auth0Id: auth0Id ?? 'Undefined',
      endpoint: 'POST /api/user'
    });

    return NextResponse.json({ errorId, error: 'There was an unexpected error. Please try again.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const auth0Id = searchParams.get('auth0Id');

  if (!name && !auth0Id) {
    logError(new Error(`Name or auth0Id is missing`), {
      endpoint: 'GET /api/user',
      task: 'Getting a user.',
    });
    return NextResponse.json({ error: "There was an error fetching user information. Please try again." }, { status: 400 });
  }

  try {
    let user;

    if (name) {
      user = await User.findOne({ name });
    } else {
      user = await User.findOne({ auth0Id });
    }
    
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.auth0Id) {
      const cookieStore = await cookies();
      cookieStore.delete('guestToken');
    }

    return NextResponse.json({ user });
  } catch (error) {
    const errorId = logError(error, {
      message: `Failed to fetch user.`,
      name: name ?? 'Undefined',
      auth0Id: auth0Id ?? 'Undefined',
      endpoint: 'GET /api/user'
    });
    return NextResponse.json({ errorId, error: "Failed to retrieve user." }, { status: 500 });
  }
}


// ✨ HELPER FUNCTION: To build the update operation using dot notation
function buildUpdateOperation(body: UserUpdatePayload) {
  const updateOp: Record<string, unknown> = {};
  const allowedTopLevelFields = ["name", "dupr"];

  for (const key of allowedTopLevelFields) {
    const value = body[key as keyof UserUpdatePayload];
    if (value === undefined || value === null) {
      continue;
    }

    if (key === "dupr" && typeof value === "object" && !Array.isArray(value)) {
      for (const duprKey in value) {
        if (Object.prototype.hasOwnProperty.call(value, duprKey)) {
          updateOp[`dupr.${duprKey}`] = value[duprKey as keyof DuprFields];
        }
      }
    } else {
      updateOp[key] = value;
    }
  }

  return { $set: updateOp };
}


export async function PATCH(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase();

    // ✨ Destructure all potential body fields for clarity. Note `upsertValue` is removed.
    const body = await req.json();
    const { findBy, name, auth0Id, userId, dupr, bypassDuprCheck } = body;

    // ✨ Simplified validation by building the filter first.
    const filter: Record<string, unknown> = {};
    switch (findBy) {
      case "name":
        if (name) filter.name = name;
        break;
      case "auth0Id":
        if (auth0Id) filter.auth0Id = auth0Id;
        break;
      case "userId":
        if (userId) filter._id = userId;
        break;
      default:
        logError(new Error(`Information is missing`), {
          endpoint: 'PATCH /api/user',
          task: 'Updating a user.',
          name: filter.name ?? 'null',
          auth0Id: filter.auth0Id ?? 'null',
          userId: filter._id ?? 'null'
        });

        return NextResponse.json(
          { error: "The request cannot be completed. Please try again later" },
          { status: 400 }
        );
    }
    
    // Check if the corresponding identifier value was provided
    if (Object.keys(filter).length === 0) {

      logError(new Error(`Missing "findby key`), {
          endpoint: 'PATCH /api/user',
          task: 'Updating a user.',
          findbykey: findBy ?? 'null'
        });

      return NextResponse.json(
         { error: "The request cannot be completed. Please try again later" },
        { status: 400 }
      );
    }

    // --- DB Call 1: Find the user ---
    const existingUser = await User.findOne(filter);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // --- SECURE: DUPR SUBSCRIPTION CHECK ---
    // If the frontend is sending us a new DUPR token to save, we MUST verify it first.
    if (dupr?.userToken) {
      if (bypassDuprCheck) {
        console.log(`[DUPR SYNC] ⚠️ BYPASSING Subscription Check for ${existingUser.email}...`);
      } else {
        console.log(`[DUPR SYNC] Verifying Subscription Status for ${existingUser.email}...`);
  
        const entitlementResult = await checkEntitlementsWithToken(dupr.userToken);
    
        if (!entitlementResult.ok) {
          return NextResponse.json(
            { error: entitlementResult.error },
            { status: entitlementResult.status }
          );
        }
  
        if (!entitlementResult.flags.hasBasicEntitlement) {
          console.warn(`[DUPR SYNC] User ${existingUser._id} blocked. Missing BASIC_L1 entitlement.`);
          return NextResponse.json(
            { error: 'You do not have access to DUPR at this time. Please contact DUPR support.' },
            { status: 403 }
          );
        }
    
        // Write all three entitlement flags into the update operation so they land
        // in the same DB write as the token save. This ensures hasPremiumEntitlement
        // (and the others) are populated immediately on first connect, not deferred
        // until the next 24-hour cache expiry.
        dupr.hasBasicEntitlement = entitlementResult.flags.hasBasicEntitlement;
        dupr.hasPremiumEntitlement = entitlementResult.flags.hasPremiumEntitlement;
        dupr.hasVerifiedEntitlement = entitlementResult.flags.hasVerifiedEntitlement;
        // Also stamp the cache timestamp so verifyDuprEntitlement won't
        // redundantly re-fetch on the very next request after connect.
        dupr.entitlementCheckedAt = new Date();
    
        console.log(`[DUPR SYNC] User verified.`, entitlementResult.flags);

        try {
          await subscribeToDuprWebhook([dupr.id]);
          console.log(`[DUPR SYNC] Subscribed ${dupr.id} to rating webhook.`);
        } catch (subError) {
          // Don't block the connect flow if subscription fails — log and continue.
          // The user can still use the app; they just won't get live rating updates
          // until we retry or they reconnect.
          console.error(`[DUPR SYNC] Webhook subscription failed for ${dupr.id}:`, subError);
        }
      }
    }

    // ✨ Build the update operation using our helper and dot notation
    const updateOperation = buildUpdateOperation(body);
    const fieldsToSet = updateOperation.$set;

    // ✨ Validate and check for duplicate name if 'name' is in the update operation
    if ("name" in fieldsToSet) {
      const trimmedName = (fieldsToSet.name as string).trim();

      if (trimmedName === "") {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }

      const safeName = escapeRegex(trimmedName);

      // --- DB Call 2 (Conditional): Check for duplicate name ---
      const duplicateUser = await User.findOne({
        name: { $regex: `^${safeName}$`, $options: "i" },
        _id: { $ne: existingUser._id },
      });

      if (duplicateUser) {
        return NextResponse.json(
          { error: "Name already exists. Choose a different name." },
          { status: 409 }
        );
      }

      fieldsToSet.name = trimmedName; // Use the trimmed name for the update
    }

    if (Object.keys(fieldsToSet).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    // --- DB Call 3: Perform the atomic update ---
    const updatedUser = await User.findOneAndUpdate(
      { _id: existingUser._id }, // Use the immutable _id for the final update
      updateOperation,
      {
        new: true, // Return the modified document
        runValidators: true,
      }
    );

    return NextResponse.json(updatedUser, { status: 200 });

  } catch (error) {
    const errorId = logError(error, {
      message: `Error while updating user.`,
      endpoint: "PATCH /api/user",
      task: "Update user record",
    });

    return NextResponse.json({ errorId, error: "An unexpected error occured. Please try again." }, { status: 500 });
  }
}

