// app/api/brand/apply/draft/route.ts
//
// Returns the user's current BrandApplication if it exists.
// If the user has a draft, returns it (used to pre-populate /apply/details).
// If they have a submitted/approved/rejected application, returns it (so the
// page can redirect to the right place).
// If nothing exists, creates a new draft and returns it.

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0'
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { BrandApplication } from '@/app/models/BrandApplication';
import { logError } from '@/lib/sentry/logger';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth0.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectToDatabase();

    const dbUser = await User.findOne({ auth0Id: session.user.sub });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Look for any existing application for this user (any status)
    const existing = await BrandApplication.findOne({ userId: dbUser._id })
      .sort({ createdAt: -1 })
      .lean();

    if (existing) {
      // If the existing application is rejected, allow a fresh start
      if (existing.status === 'rejected') {
        const draft = await BrandApplication.create({
          userId: dbUser._id,
          email: dbUser.email,
          status: 'draft',
        });
        return NextResponse.json({ application: draft.toObject() });
      }
      return NextResponse.json({ application: existing });
    }

    // No application exists — create a draft
    const draft = await BrandApplication.create({
      userId: dbUser._id,
      email: dbUser.email,
      status: 'draft',
    });

    return NextResponse.json({ application: draft.toObject() });
  } catch (err: any) {
    console.error('[BrandApplyDraft] Error:', err);
    logError(err, { endpoint: 'GET /api/brand/apply/draft' });
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}