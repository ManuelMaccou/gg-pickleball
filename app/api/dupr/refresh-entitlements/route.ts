// Forces a fresh entitlement check from DUPR, bypassing the 24-hour cache.
// Used by DuprConnectModal after the user closes the modal — covers the case
// where they upgraded to DUPR+ inside the iframe after the initial entitlement
// check ran on connect.

import { NextRequest, NextResponse } from 'next/server';
import { forceRefreshDuprEntitlements } from '@/lib/services/dupr/duprEntitlement';
import User from '@/app/models/User';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const result = await forceRefreshDuprEntitlements(user.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Return the updated user so the client can update local state without
    // a separate fetch.
    const updatedUser = await User.findById(user.id).lean();
    return NextResponse.json(updatedUser);
  } catch (err) {
    console.error('[POST /api/dupr/refresh-entitlements]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}