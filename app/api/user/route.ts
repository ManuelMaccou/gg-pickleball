import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { escapeRegex } from '@/utils/escapeRegex';
import { logError } from '@/lib/sentry/logger';

await connectToDatabase();

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

export async function PATCH(req: Request) {
  try {
    await connectToDatabase();

    const { findBy, upsertValue, ...updateFields } = await req.json();

    if (!findBy || (!updateFields.userName && !updateFields.auth0Id && !updateFields.userId)) {
      logError(new Error('Missing findBy key or corresponding user identifier'), {
        endpoint: 'PATCH /api/user',
        task: 'Update user record'
      });

      return NextResponse.json({ error: "Missing findBy key or corresponding user identifier" }, { status: 400 });
    }

    interface FilterType {
      name?: string;
      auth0Id?: string;
      userId?: string;
    }

    const filter: FilterType = {};
    if (findBy === 'userName' && updateFields.userName) filter.name = updateFields.userName;
    if (findBy === 'auth0Id' && updateFields.auth0Id) filter.auth0Id = updateFields.auth0Id;
    if (findBy === 'userId' && updateFields.userId) filter.userId = updateFields.userId;


    if (Object.keys(filter).length === 0) {
      logError(new Error('Invalid request. No valid identifier provided.'), {
        endpoint: 'PATCH /api/user',
        task: 'Update user record'
      });

      return NextResponse.json({ error: "Invalid request. No valid identifier provided." }, { status: 400 });
    }

    // Find user by ID and update with the provided fields
    const updatedUser = await User.findOneAndUpdate(
      filter,
      { ...updateFields },
      { new: true, runValidators: true, upsert: upsertValue ? upsertValue : false }
    );

    if (!updatedUser) {
      logError(new Error('User not found when trying to update.'), {
        endpoint: 'PATCH /api/user',
        task: 'Update user record'
      });

      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    logError(error, {
      message: `Error while updating user.`
    });

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}