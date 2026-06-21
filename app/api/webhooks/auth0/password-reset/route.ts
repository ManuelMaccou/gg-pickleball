import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== process.env.AUTH0_ACTION_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Body
    const body = await req.json();
    const { sub } = body;

    console.log("body:", body)

    if (!sub) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    await connectToDatabase();

    // 3. Update Local DB
    // We simply set accountClaimed to true. 
    // It is idempotent (safe to run multiple times).
    const updatedUser = await User.findOneAndUpdate(
      { auth0Id: sub },
      { $set: { accountClaimed: true } },
      { new: true }
    );

    if (updatedUser) {
      console.log(`[Password Webhook] User ${sub} marked as claimed in local DB.`);
    } else {
      console.warn(`[Password Webhook] User ${sub} changed password but was not found in local DB.`);
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    const errorId = logError(new Error(errorMessage), { 
        endpoint: 'POST /api/webhooks/auth0/password-change',
        task: 'Marking account as claimed via webhook'
    });

    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}