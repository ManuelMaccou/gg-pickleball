// app/api/admin/onboard/route.ts
//
// Superadmin-only. Supports the custom app client onboarding flow.
//
// POST — creates a new Client with defaults appropriate for custom app mode:
//         retailSoftware: 'shopify', rewardProducts: ['online store']
//         Returns the new clientId.
//
// PATCH — saves shopDomain and envKey to an existing Client's shopify sub-doc.
//          Called in step 2 of the onboarding flow after the client is created.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import { logError } from '@/lib/sentry/logger';

// ── POST — create client with defaults ───────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await Client.findOne({ name: name.trim() }).lean();
    if (existing) {
      return NextResponse.json(
        { error: `A client named "${name.trim()}" already exists.` },
        { status: 409 }
      );
    }

    const client = await Client.create({
      name: name.trim(),
      retailSoftware: 'shopify',
      rewardProducts: ['online store'],
      active: false,
    });

    console.log(`[Onboard] Created client "${client.name}" — id: ${client._id}`);

    return NextResponse.json({ clientId: client._id.toString(), name: client.name });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/admin/onboard' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── PATCH — save shopDomain + envKey + installUrl ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { clientId, shopDomain, envKey, installUrl } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });
    }
    if (!shopDomain?.trim()) {
      return NextResponse.json({ error: 'shopDomain is required.' }, { status: 400 });
    }
    if (!envKey?.trim()) {
      return NextResponse.json({ error: 'envKey is required.' }, { status: 400 });
    }

    // Normalise domain — strip protocol and trailing slash
    const cleanDomain = shopDomain.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    // Uppercase envKey for consistency with env var naming convention
    const cleanEnvKey = envKey.trim().toUpperCase().replace(/\s+/g, '_');

    await connectToDatabase();

    const updateFields: Record<string, string> = {
      'shopify.shopDomain': cleanDomain,
      'shopify.envKey': cleanEnvKey,
    };

    if (installUrl?.trim()) {
      updateFields['shopify.installUrl'] = installUrl.trim();
    }

    const updated = await Client.findByIdAndUpdate(
      clientId,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    console.log(
      `[Onboard] Saved shopDomain: ${cleanDomain}, envKey: ${cleanEnvKey}` +
      `${installUrl ? ', installUrl saved' : ''} for client ${clientId}`
    );

    return NextResponse.json({
      shopDomain: cleanDomain,
      envKey: cleanEnvKey,
      ...(installUrl?.trim() && { installUrl: installUrl.trim() }),
    });
  } catch (err) {
    logError(err, { endpoint: 'PATCH /api/admin/onboard' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}