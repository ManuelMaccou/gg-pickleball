// lib/admin/inviteAdminToClient.ts
//
// Shared helper that finds-or-creates a User, links them as an Admin to a Client,
// and sends the password-set or welcome email. Used by:
//   - POST /api/admin-tasks/onboard-client/invite-admin (superadmin manual flow)
//   - PATCH /api/admin/brand-applications/[id] (when approving a brand application)

import { ManagementClient } from 'auth0';
import User from '@/app/models/User';
import Admin from '@/app/models/Admin';
import { sendNotificationEmail } from '@/lib/mailgun/sendNotificationEmail';
import type { IClient } from '@/app/types/databaseTypes';

interface InviteAdminParams {
  client: IClient & { _id: any };
  email: string;
  name: string; // user's name (or brand name as fallback)
}

interface InviteAdminResult {
  alreadyAdmin: boolean;
  emailSent: boolean;
}

export async function inviteAdminToClient({
  client,
  email,
  name,
}: InviteAdminParams): Promise<InviteAdminResult> {
  const auth0 = new ManagementClient({
    domain: process.env.AUTH0_ISSUER_BASE_URL!,
    clientId: process.env.AUTH0_M2M_CLIENT_ID!,
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
  });

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // --- 1. FIND OR CREATE USER ---
  let localUser = await User.findOne({ email: normalizedEmail });
  let needsPasswordReset = false;
  let auth0Id: string;

  if (!localUser) {
    try {
      const auth0NewUser = await auth0.users.create({
        connection: 'GG-Pickleball',
        email: normalizedEmail,
        name: cleanName,
        password: Math.random().toString(36).slice(-16),
        email_verified: true,
      });
      const newUserId = auth0NewUser.data?.user_id || (auth0NewUser as any).user_id;
      if (!newUserId) throw new Error('Auth0 failed to return a user_id');
      auth0Id = newUserId;
    } catch (auth0Error: any) {
      if (auth0Error.statusCode === 409) {
        const searchResponse = await auth0.users.listUsersByEmail({ email: normalizedEmail });
        if (searchResponse && searchResponse.length > 0 && searchResponse[0].user_id) {
          auth0Id = searchResponse[0].user_id;
        } else {
          throw new Error(`Auth0 reported user exists, but search failed for ${normalizedEmail}.`);
        }
      } else {
        throw auth0Error;
      }
    }

    localUser = await User.create({
      name: cleanName,
      email: normalizedEmail,
      auth0Id,
      isGuest: false,
      accountClaimed: false,
    });

    needsPasswordReset = true;
  } else {
    auth0Id = localUser.auth0Id!;

    if (!auth0Id) {
      const searchResponse = await auth0.users.listUsersByEmail({ email: normalizedEmail });
      if (searchResponse && searchResponse.length > 0 && searchResponse[0].user_id) {
        auth0Id = searchResponse[0].user_id;
        localUser.auth0Id = auth0Id;
        await localUser.save();
      } else {
        const auth0NewUser = await auth0.users.create({
          connection: 'GG-Pickleball',
          email: normalizedEmail,
          name: localUser.name,
          password: Math.random().toString(36).slice(-16),
          email_verified: true,
        });
        const newUserId = auth0NewUser.data?.user_id || (auth0NewUser as any).user_id;
        if (!newUserId) throw new Error('Auth0 failed to return a user_id');
        auth0Id = newUserId;
        localUser.auth0Id = auth0Id;
        await localUser.save();
      }
    }

    if (!localUser.accountClaimed) {
      needsPasswordReset = true;
    }
  }

  // --- 2. CREATE OR FIND ADMIN RECORD ---
  const existingAdminRecord = await Admin.findOne({
    user: localUser._id,
    location: client._id,
  });

  if (!existingAdminRecord) {
    await Admin.create({
      user: localUser._id,
      location: client._id,
      permission: 'admin',
      clientName: client.name,
      name: localUser.name,
    });
  }

  // --- 3. GENERATE RESET LINK & SEND EMAIL ---
  let resetLink: string | undefined;

  if (needsPasswordReset && localUser.auth0Id) {
    try {
      const ticketResponse = await auth0.tickets.changePassword({
        user_id: localUser.auth0Id,
        client_id: process.env.AUTH0_CLIENT_ID,
      });
      resetLink = (ticketResponse as any).data?.ticket || (ticketResponse as any).ticket;
    } catch (ticketError: any) {
      if (ticketError.statusCode === 404) {
        const auth0NewUser = await auth0.users.create({
          connection: 'GG-Pickleball',
          email: normalizedEmail,
          name: localUser.name,
          password: Math.random().toString(36).slice(-16),
          email_verified: true,
        });
        const newAuth0Id = (auth0NewUser as any).data?.user_id || (auth0NewUser as any).user_id;
        localUser.auth0Id = newAuth0Id;
        await localUser.save();

        const retryTicket = await auth0.tickets.changePassword({
          user_id: newAuth0Id,
          client_id: process.env.AUTH0_CLIENT_ID,
        });
        resetLink = (retryTicket as any).data?.ticket || (retryTicket as any).ticket;
      } else {
        throw ticketError;
      }
    }
  }

  const actionUrl = resetLink ? resetLink : `${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand`;
  const buttonText = resetLink ? 'Set Your Password' : 'Go to Dashboard';
  const bodyText = resetLink
    ? `You have been added as an admin to ${client.name} on GG Pickleball. Please set your password to access your new partner dashboard.`
    : `You have been added as an admin to ${client.name} on GG Pickleball. You can now access your brand's settings from your partner dashboard.`;

  await sendNotificationEmail({
    email: normalizedEmail,
    template: 'gg_admin_invite',
    subject: `You've been invited to manage ${client.name}`,
    variables: {
      headline: `Welcome!`,
      body_text: bodyText,
      button_text: buttonText,
      action_url: actionUrl,
    },
  });

  return {
    alreadyAdmin: !!existingAdminRecord,
    emailSent: true,
  };
}