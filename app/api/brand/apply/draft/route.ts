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

    // ── Check for existing application by this user ───────────────────────
    const existing = await BrandApplication.findOne({ userId: dbUser._id })
      .sort({ createdAt: -1 })
      .lean();

    if (existing) {
      // Rejected — create a fresh draft and signal the UI to show a notice
      if (existing.status === 'rejected') {
        const draft = await BrandApplication.create({
          userId: dbUser._id,
          email: dbUser.email,
          status: 'draft',
        });
        return NextResponse.json({
          application: draft.toObject(),
          wasRejected: true,
        });
      }
      return NextResponse.json({ application: existing, wasRejected: false });
    }

    // ── Create a fresh draft ──────────────────────────────────────────────
    const draft = await BrandApplication.create({
      userId: dbUser._id,
      email: dbUser.email,
      status: 'draft',
    });

    return NextResponse.json({ application: draft.toObject(), wasRejected: false });
  } catch (err: any) {
    console.error('[BrandApplyDraft] Error:', err);
    logError(err, { endpoint: 'GET /api/brand/apply/draft' });
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}