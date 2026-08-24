// Destination: app/api/admin/player-identity-issues/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import PlayerIdentityIssue from '@/app/models/PlayerIdentityIssue';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (!authorizedUser?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'open' | 'resolved' | omitted (all)

    const query: Record<string, any> = {};
    if (status === 'open' || status === 'resolved') {
      query.status = status;
    }

    const issues = await PlayerIdentityIssue.find(query)
      .populate('implicatedUserIds', 'name email dupr identityUnresolved')
      .populate('programId', 'name')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ issues });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/admin/player-identity-issues' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}