// lib/auth/requiresBrandAdmin.ts
//
// Shared auth guard for brand API routes. Call at the top of any route that
// operates on brand-specific data.
//
// Checks (in order):
//   1. Caller is authenticated (valid session)
//   2. Caller has a brand admin record (adminLocationId is set)
//   3. The clientId param matches the caller's adminLocationId
//      — prevents a valid admin from querying another brand's data
//
// Usage:
//   const result = await requiresBrandAdmin(request);
//   if (result.error) return result.error;
//   const { clientId } = result; // verified, safe to use directly

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

type Success = {
  error: null;
  clientId: string;
};

type Failure = {
  error: NextResponse;
  clientId: null;
};

export type BrandAdminAuthResult = Success | Failure;

export async function requiresBrandAdmin(
  request: NextRequest,
  clientId: string | null
): Promise<BrandAdminAuthResult> {
  // 1. Must be authenticated
  const user = await getAuthorizedUser(request);
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      clientId: null,
    };
  }

  // 2. Must have a brand admin record
  if (!user.adminLocationId) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      clientId: null,
    };
  }

  // 3. clientId param must be present and match their own location
  // This prevents a valid admin from querying another brand's data
  // by swapping the clientId query param.
  if (!clientId) {
    return {
      error: NextResponse.json({ error: 'clientId is required' }, { status: 400 }),
      clientId: null,
    };
  }

  if (clientId !== user.adminLocationId) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      clientId: null,
    };
  }

  return { error: null, clientId };
}