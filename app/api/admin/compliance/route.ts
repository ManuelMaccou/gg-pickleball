// app/api/admin/compliance/route.ts
// Superadmin only — list and resolve compliance requests.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import ComplianceRequest from '@/app/models/ComplianceRequest';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;

    const requests = await ComplianceRequest.find(filter)
      .sort({ status: 1, dueAt: 1 })
      .lean();

    return NextResponse.json({ requests });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/admin/compliance' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { id, note } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const request = await ComplianceRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.status === 'completed') {
      return NextResponse.json({ error: 'Already completed' }, { status: 400 });
    }

    request.status = 'completed';
    request.completedAt = new Date();
    if (note) request.notes = (request.notes ? request.notes + '\n' : '') + `Completed: ${note}`;
    await request.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'PATCH /api/admin/compliance' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}