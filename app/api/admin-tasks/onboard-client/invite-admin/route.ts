import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import User from '@/app/models/User';
import Admin from '@/app/models/Admin'; 
import { ManagementClient } from 'auth0';
import { sendNotificationEmail } from '@/lib/mailgun/sendNotificationEmail';
import { logError } from '@/lib/sentry/logger';

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser?.superAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Super Admins only.' }, { status: 403 });
  }

  // --- 1. INITIALIZE AUTH0 CLIENT ---
  const auth0 = new ManagementClient({
    domain: process.env.AUTH0_ISSUER_BASE_URL!,
    clientId: process.env.AUTH0_M2M_CLIENT_ID!,
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
  });

  try {
    const body = await req.json();
    const { clientId, name, email } = body;

    if (!clientId || !email || !name) {
      return NextResponse.json({ error: 'Client ID, name, and Email are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    
    await connectToDatabase();

    // --- 2. VERIFY CLIENT EXISTS ---
    const client = await Client.findById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    // --- 3. FIND OR CREATE USER (SELF-HEALING) ---
    let localUser = await User.findOne({ email: normalizedEmail });
    let needsPasswordReset = false;
    let auth0Id: string;

    if (!localUser) {
      console.log(`User not found in local DB. Creating new Auth0 user for ${normalizedEmail}...`);
      const defaultName = cleanName; 

      try {
        const auth0NewUser = await auth0.users.create({
          connection: 'GG-Pickleball',
          email: normalizedEmail,
          name: defaultName,
          password: Math.random().toString(36).slice(-16), 
          email_verified: true,
        });

        if (!auth0NewUser.user_id) throw new Error('Auth0 failed to return a user_id');
        auth0Id = auth0NewUser.user_id;

      } catch (auth0Error: any) {
        if (auth0Error.statusCode === 409) {
          console.log(`User exists in Auth0 but not locally. Fetching Auth0 ID...`);
          
          const searchResponse = await auth0.users.listUsersByEmail({ email: normalizedEmail });
          const usersByEmail = searchResponse;

          if (usersByEmail && usersByEmail.length > 0 && usersByEmail[0].user_id) {
            auth0Id = usersByEmail[0].user_id;
          } else {
             throw new Error(`Auth0 reported user exists, but search failed for ${normalizedEmail}.`);
          }
        } else {
          throw auth0Error;
        }
      }

      // Create the missing local record
      localUser = await User.create({
        name: defaultName,
        email: normalizedEmail,
        auth0Id: auth0Id,
        isGuest: false,
        accountClaimed: false, 
      });

      needsPasswordReset = true;

    } else {
      // User exists in local DB
      auth0Id = localUser.auth0Id!;
      
      if (!auth0Id) {
          console.log(`Local user found but missing Auth0 ID. Fetching from Auth0...`);
          const searchResponse = await auth0.users.listUsersByEmail({ email: normalizedEmail });
          const usersByEmail = searchResponse;

          if (usersByEmail && usersByEmail.length > 0 && usersByEmail[0].user_id) {
             auth0Id = usersByEmail[0].user_id;
             localUser.auth0Id = auth0Id;
             await localUser.save();
          } else {
             console.log(`Local user exists, but not in Auth0. Re-creating in Auth0...`);
             const auth0NewUser = await auth0.users.create({
                connection: 'GG-Pickleball',
                email: normalizedEmail,
                name: localUser.name,
                password: Math.random().toString(36).slice(-16), 
                email_verified: true,
             });
             
             if (!auth0NewUser.user_id) throw new Error('Auth0 failed to return a user_id');
             auth0Id = auth0NewUser.user_id;
             localUser.auth0Id = auth0Id;
             await localUser.save();
          }
      } else {
         // Sync local DB if auth0Id doesn't match for some reason
         if (localUser.auth0Id !== auth0Id) {
             localUser.auth0Id = auth0Id;
             await localUser.save();
         }
      }

      if (!localUser.accountClaimed) {
        needsPasswordReset = true;
      }
    }

    // --- 4. CREATE ADMIN LINK RECORD ---
    const existingAdminRecord = await Admin.findOne({
      user: localUser._id,
      location: client._id
    });

    let shouldSendEmail = true;

    if (!existingAdminRecord) {
      console.log(`Creating Admin record linking ${localUser.email} to ${client.name}...`);
      await Admin.create({
        user: localUser._id,
        location: client._id,
        permission: 'admin', 
        clientName: client.name,
        name: localUser.name
      });
    } else {
      console.log(`User ${localUser.email} is already an admin for ${client.name}. Resending invite...`);
    }

    // --- 5. GENERATE RESET LINK & SEND EMAIL ---
    // Only proceed with emailing if they are actually a NEW admin for this club
    if (shouldSendEmail) {
        let resetLink: string | undefined;
        
        // If they haven't claimed their account, they need the password ticket
        if (needsPasswordReset && localUser.auth0Id) {
          console.log(`Generating password reset ticket for ${normalizedEmail}...`);
          try {
            const ticketResponse = await auth0.tickets.changePassword({
              user_id: localUser.auth0Id,
              client_id: process.env.AUTH0_CLIENT_ID,
            });

            resetLink = ticketResponse.data?.ticket || (ticketResponse as any).ticket;

          } catch (ticketError: any) {
            if (ticketError.statusCode === 404) {
               console.log("Auth0 user missing (404). Re-creating them in Auth0...");
               
               const auth0NewUser = await auth0.users.create({
                 connection: 'GG-Pickleball',
                 email: normalizedEmail,
                 name: localUser.name,
                 password: Math.random().toString(36).slice(-16), 
                 email_verified: true,
               });
               
               const newAuth0Id = auth0NewUser.data?.user_id || (auth0NewUser as any).user_id;
               
               localUser.auth0Id = newAuth0Id;
               await localUser.save();
               
               const retryTicket = await auth0.tickets.changePassword({
                 user_id: newAuth0Id,
                 client_id: process.env.AUTH0_CLIENT_ID,
               });
               
               resetLink = retryTicket.data?.ticket || (retryTicket as any).ticket;
            } else {
               throw ticketError; 
            }
          }
        }
        
        console.log(`Sending Admin Invite Email to ${normalizedEmail}...`);
        
        // Use the reset link if they need one, otherwise point them straight to the brand dashboard.
        const actionUrl = resetLink ? resetLink : `${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand`;
        const buttonText = resetLink ? "Set Your Password" : "Go to Dashboard";
        const bodyText = resetLink 
            ? `You have been added as an admin to ${client.name} on GG Pickleball. Please set your password to access your new partner dashboard.`
            : `You have been added as an admin to ${client.name} on GG Pickleball. You can now access this location's settings from your partner dashboard.`;

        await sendNotificationEmail({
          email: normalizedEmail,
          template: 'gg_admin_invite',
          subject: `You've been invited to manage ${client.name}`,
          variables: {
              headline: `Welcome, ${localUser.name}!`,
              body_text: bodyText,
              button_text: buttonText,
              action_url: actionUrl
          }
        });
    }

    return NextResponse.json({ 
      success: true, 
      message: existingAdminRecord 
        ? `Invite resent to ${normalizedEmail}.` 
        : `Admin access granted and email sent to ${normalizedEmail}.`
    });

  } catch (error: any) {
    console.error('Error inviting admin:', error);
    logError(error, { endpoint: 'POST /api/admin-tasks/onboard-client/invite-admin' });
    
    return NextResponse.json({ 
        error: error.message || 'An internal server error occurred.' 
    }, { status: 500 });
  }
}