import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { logError } from '@/lib/sentry/logger';

interface Auth0WebhookPayload {
  sub: string;
  email: string;
  name: string;
  guest_username?: string;
  email_verified?: boolean;
  brand_optin?: boolean;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateUniqueUsername(baseName: string): Promise<string> {
  let potentialName = baseName;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    const safeName = escapeRegex(potentialName);
    const query = { name: { $regex: `^${safeName}$`, $options: 'i' } };
    const existingUser = await User.findOne(query).lean();

    if (!existingUser) {
      isUnique = true;
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      potentialName = `${baseName}${randomSuffix}`;
      attempts++;
    }
  }

  if (!isUnique) {
    throw new Error('Could not generate a unique username after multiple attempts.');
  }

  return potentialName;
}

// Called by an Auth0 Post-Login Action after a user signs in or signs up.
// Creates a User record in the database if one doesn't exist.
// Also syncs accountClaimed and brandOptin on subsequent logins.

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== process.env.AUTH0_ACTION_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body = (await req.json()) as Auth0WebhookPayload;
    const { sub, email, email_verified, guest_username, brand_optin } = body;

    if (!sub || !email) {
      logError(new Error('Missing required fields: sub and email'), {
        endpoint: 'POST /api/user/auth0/create-user',
      });
      return NextResponse.json(
        { error: 'There was an error creating a user. Please try again.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 3. Guest promotion — if guest_username present, promote to full user
    if (guest_username) {
      const promotedUser = await User.findOneAndUpdate(
        { name: guest_username, auth0Id: { $exists: false } },
        { $set: { auth0Id: sub, email } },
        { new: true }
      );
      if (promotedUser) {
        return NextResponse.json({ success: true, message: 'User promoted' }, { status: 200 });
      }
    }

    // 4. Returning user — sync accountClaimed and brandOptin if needed
    const existingUser = await User.findOne({ auth0Id: sub }).lean() as any;
    if (existingUser) {
      const updates: Record<string, unknown> = {};

      // Mark account as claimed on first verified login
      if (!existingUser.accountClaimed && email_verified) {
        updates.accountClaimed = true;
      }

      // Sync brand opt-in from Auth0 app_metadata
      if (typeof brand_optin === 'boolean' && existingUser.brandOptin !== brand_optin) {
        updates.brandOptin = brand_optin;
      }

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(existingUser._id, { $set: updates });
      }

      return NextResponse.json({ message: 'User already exists' }, { status: 200 });
    }

    // 5. New user — generate unique username and create record
    const baseName = email.split('@')[0].trim();
    if (!baseName) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }

    const uniqueName = await generateUniqueUsername(baseName);

    const newUser = new User({
      auth0Id: sub,
      email,
      name: uniqueName,
      isGuest: false,
      brandOptin: typeof brand_optin === 'boolean' ? brand_optin : false,
      createdAt: new Date(),
    });

    await newUser.save();

    return NextResponse.json(
      { success: true, userId: newUser._id, name: uniqueName },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    const errorId = logError(new Error(errorMessage), {
      endpoint: 'POST /api/user/auth0/create-user',
      task: 'Creating auth0 user',
    });
    return NextResponse.json(
      { errorId, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}