import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { escapeRegex } from '@/utils/escapeRegex';
import { logError } from '@/lib/sentry/logger';

await connectToDatabase();

type DuprFields = {
  rating?: number;
  verified?: boolean;
};

type UserUpdatePayload = {
  name?: string;
  dupr?: DuprFields;
};

export async function POST(request: Request) {
  let name: string | undefined,
    auth0Id: string | undefined;

  try {
    const body = await request.json();
    name = body.name;
    auth0Id = body.auth0Id

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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
    logError(error, {
      message: `Failed to save user.`,
      name: name ?? 'Undefined',
      auth0Id: auth0Id ?? 'Undefined',
    });

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const auth0Id = searchParams.get('auth0Id');

  if (!name && !auth0Id) {
    return NextResponse.json({ error: "Name or auth0Id is required." }, { status: 400 });
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
    logError(error, {
      message: `Failed to fetch user.`,
      name: name ?? 'Undefined',
      auth0Id: auth0Id ?? 'Undefined',
    });
    return NextResponse.json({ error: "Failed to retrieve user." }, { status: 500 });
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



export async function PATCH(req: Request) {
  try {
    await connectToDatabase();

    // ✨ Destructure all potential body fields for clarity. Note `upsertValue` is removed.
    const body = await req.json();
    const { findBy, name, auth0Id, userId } = body;

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
        return NextResponse.json(
          { error: "A valid 'findBy' key is required: name, auth0Id, or userId." },
          { status: 400 }
        );
    }
    
    // Check if the corresponding identifier value was provided
    if (Object.keys(filter).length === 0) {
      return NextResponse.json(
        { error: `Missing value for the specified 'findBy' key: '${findBy}'` },
        { status: 400 }
      );
    }

    // --- DB Call 1: Find the user ---
    const existingUser = await User.findOne(filter);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    logError(error, {
      message: `Error while updating user.`,
      endpoint: "PATCH /api/user",
      task: "Update user record",
    });

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

