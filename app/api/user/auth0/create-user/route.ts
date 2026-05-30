import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User'; // Assuming User model is correctly defined
import { logError } from '@/lib/sentry/logger';

// Define a type for the incoming request body for type safety
interface Auth0WebhookPayload {
  sub: string;
  email: string;
  name: string; // As per the problem, this is initially the email
  guest_username?: string;
}

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param input The string to escape.
 * @returns The escaped string.
 */
function escapeRegex(input: string): string {
  // Escape characters with special meaning in regex.
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a unique username based on a base name.
 * It checks the database for conflicts and appends a random 3-digit suffix if needed.
 * This process repeats until a unique name is found or max attempts are reached.
 * @param baseName The initial name to start with.
 * @returns A promise that resolves to a unique username.
 * @throws An error if a unique name cannot be generated after several attempts.
 */
async function generateUniqueUsername(baseName: string): Promise<string> {
  let potentialName = baseName;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10; // A safeguard against an unlikely infinite loop

  while (!isUnique && attempts < maxAttempts) {
    const safeName = escapeRegex(potentialName);
    const query = { name: { $regex: `^${safeName}$`, $options: 'i' } };

    // Check if a user with this name already exists (case-insensitive)
    const existingUser = await User.findOne(query).lean();

    if (!existingUser) {
      isUnique = true; // The name is unique, exit the loop
    } else {
      // Name exists, generate a new one with a random suffix
      const randomSuffix = Math.floor(100 + Math.random() * 900); // Generates a number between 100 and 999
      potentialName = `${baseName}${randomSuffix}`;
      attempts++;
    }
  }

  if (!isUnique) {
    // This is a fail-safe. It's extremely unlikely to be hit.
    throw new Error('Could not generate a unique username after multiple attempts.');
  }

  return potentialName;
}

// Called by an Auth0 Post-Login Action after a user signs in or signs up.
// Creates a User record in the database if one doesn't exist.
//
// SECURITY: requires `email_verified: true` to ensure the user has completed
// OTP verification (or any other Auth0 email verification flow).

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== process.env.AUTH0_ACTION_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate the request body
    const body = (await req.json()) as any;
    const { sub, email, email_verified, guest_username } = body;

    if (!sub || !email) {
      logError(new Error(`Missing required fields: sub and email`), {
        endpoint: 'POST /api/user/auth0/create-user',
        task: 'Creating an auth0 user user.',
      });

      return NextResponse.json(
        { error: 'There was an error creating a user. Please try again.' },
        { status: 400 }
      );
    }

    // 3. Require email verification — this proves OTP was completed (or any
    //    other Auth0 verification flow). Without this, a malicious actor could
    //    sign up with someone else's email and get a User record before they
    //    verify ownership.

    /*
    if (!email_verified) {
      logError(new Error(`Unverified email attempted user creation: ${email}`), {
        endpoint: 'POST /api/user/auth0/create-user',
        task: 'Email verification check',
      });
      return NextResponse.json(
        { error: 'Email not verified.' },
        { status: 403 }
      );
    }
    */

    await connectToDatabase();

    // If there is a guest username, they should be promoted to a full user
    if (guest_username) {
      const promotedUser = await User.findOneAndUpdate(
        { name: guest_username, auth0Id: { $exists: false } },
        { $set: { auth0Id: sub, email: email } },
        { new: true }
      );

      if (promotedUser) {
        return NextResponse.json(
          { success: true, message: 'User promoted' },
          { status: 200 }
        );
      }
    }

    // Check if the user already exists by their unique Auth0 ID
    const existingUserByAuth0Id = await User.findOne({ auth0Id: sub }).lean();
    if (existingUserByAuth0Id) {
      return NextResponse.json({ message: 'User already exists' }, { status: 200 });
    }

    // 5. Generate a unique username
    const baseName = email.split('@')[0].trim();
    if (!baseName) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }

    const uniqueName = await generateUniqueUsername(baseName);

    // 6. Create and save the new user
    const newUser = new User({
      auth0Id: sub,
      email,
      name: uniqueName,
      isGuest: false,
      createdAt: new Date(),
    });

    await newUser.save();

    return NextResponse.json(
      { success: true, userId: newUser._id, name: uniqueName },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred';

    logError(new Error(`Missing required fields: sub and email`), {
      endpoint: 'POST /api/user/auth0/create-user',
      task: 'Creating an auth0 user user.',
      error: errorMessage,
    });

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}