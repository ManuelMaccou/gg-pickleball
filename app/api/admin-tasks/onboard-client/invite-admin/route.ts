// app/api/admin-tasks/onboard-client/invite-admin/route.ts
//
// Superadmin-only endpoint to invite an admin to an existing Client.
// Delegates the find-or-create User + create Admin + send email logic
// to lib/admin/inviteAdminToClient so the public self-signup flow can
// reuse the same code path.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { inviteAdminToClient } from '@/lib/admin/inviteAdminToClient';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser?.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Super Admins only.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { clientId, name, email } = body;

    if (!clientId || !email || !name) {
      return NextResponse.json(
        { error: 'Client ID, name, and Email are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const client = await Client.findById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    const result = await inviteAdminToClient({ client, email, name });

    return NextResponse.json({
      success: true,
      message: result.alreadyAdmin
        ? `Invite resent to ${email}.`
        : `Admin access granted and email sent to ${email}.`,
    });
  } catch (error: any) {
    console.error('Error inviting admin:', error);
    logError(error, { endpoint: 'POST /api/admin-tasks/onboard-client/invite-admin' });
    return NextResponse.json(
      { error: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}