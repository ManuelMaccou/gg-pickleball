// app/api/brand/confirm-plan/route.ts
//
// Called by the brand dashboard when plan_handle is present in the URL,
// meaning Shopify just redirected back after plan selection.
// Sets hasActivePlan: true immediately so the dashboard renders correctly
// on first load without waiting for the shopify-status Partner API check.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) return NextResponse.json({ error: 'No admin location' }, { status: 403 });

    const { planHandle } = await req.json();
    if (!planHandle) return NextResponse.json({ error: 'Missing planHandle' }, { status: 400 });

    await connectToDatabase();

    await Client.findByIdAndUpdate(user.adminLocationId, {
      $set: {
        'shopify.hasActivePlan': true,
        'shopify.planHandle': planHandle,
      },
    });

    console.log(`[ConfirmPlan] Set hasActivePlan: true for client ${user.adminLocationId}, plan: ${planHandle}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/brand/confirm-plan' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}