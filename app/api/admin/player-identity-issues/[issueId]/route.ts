// Destination: app/api/admin/player-identity-issues/[issueId]/route.ts
//
// Notes-only update — deliberately separate from resolve, so context can
// be jotted down (e.g. "emailed player 8/20, waiting on reply") without
// attempting a resolution.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import PlayerIdentityIssue from '@/app/models/PlayerIdentityIssue';
import { logError } from '@/lib/sentry/logger';

interface Params {
  params: Promise<{ issueId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (!authorizedUser?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { issueId } = await params;
    const { notes } = await req.json();

    if (typeof notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string.' }, { status: 400 });
    }

    const issue = await PlayerIdentityIssue.findByIdAndUpdate(
      issueId,
      { $set: { notes } },
      { new: true }
    );

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    return NextResponse.json({ issue });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'PATCH /api/admin/player-identity-issues/[issueId]' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}