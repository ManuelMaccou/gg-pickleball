import User from '@/app/models/User';
import { Auth0User } from '@/app/types/auth0Types';
import { generateUniqueUsername } from '@/utils/generateUniqueUsername';
import { ManagementClient} from 'auth0';
import { ClientSession } from 'mongoose';


interface UserCreationResult {
  originalName: string;
  user: { _id: string; name: string; auth0Id: string; };
  passwordResetLink?: string;
}

type RequiredDbOptions = { session: ClientSession };

// Initialize Auth0 Management Client
const auth0 = new ManagementClient({
  domain: process.env.AUTH0_ISSUER_BASE_URL!,
  clientId: process.env.AUTH0_M2M_CLIENT_ID!,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
});

async function getManagementApiToken(): Promise<string> {
  const response = await fetch(`https://${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID!,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET!,
      audience: `https://${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error('Failed to get Auth0 Management API token.');
  }
  return data.access_token;
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Finds a user by email, creating them in Auth0 and the local DB if necessary.
 * This function is designed to be resumable (idempotent).
 * @param name - The desired name from the CSV.
 *- The user's email from the CSV.
 * @returns An object containing the user document and an optional password reset link if newly created.
 */

export async function findOrCreateUserForUpload(
  name: string, 
  email: string, 
  duprId: string,
  dbOptions: RequiredDbOptions
): Promise<UserCreationResult> {

  if (!name || !email) {
    throw new Error('User name and email cannot be empty.');
  }

  const session = dbOptions.session;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedInputName = toTitleCase(name.trim());

  let auth0User: Auth0User | undefined;
  let needsPasswordReset = false;

  let localUser = await User.findOne({
    email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
  }).session(session); 

  // --- Step 1: Check Auth0 by email ---
  const token = await getManagementApiToken();

  const response = await fetch(
    `https://${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users-by-email?email=${encodeURIComponent(normalizedEmail)}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Auth0 API request failed with status: ${response.status}`);
  }

  const usersByEmail: Auth0User[] = await response.json();
  
  if (usersByEmail.length > 0) {
    auth0User = usersByEmail[0];
    console.log(`Found existing Auth0 user: ${auth0User.user_id}`);
  } else {
    // User does NOT exist in Auth0. We must create them.
    console.log(`User not found in Auth0. Creating...`);
    
    const auth0NewUser = await auth0.users.create({
      connection: 'GG-Pickleball',
      email: normalizedEmail,
      name: normalizedInputName,
      password: Math.random().toString(36).slice(-12),
      email_verified: true,
    });

    console.log("auth0NewUserResponse,", auth0NewUser);

    if (typeof auth0NewUser.user_id !== 'string') {
      console.error("Auth0 user creation response did not contain a valid user_id string.", auth0NewUser);
      throw new Error(`Auth0 user creation failed for ${normalizedEmail}`);
    }

    auth0User = auth0NewUser as Auth0User;
    needsPasswordReset = true;
  }

  if (!auth0User?.user_id) {
    throw new Error(`Failed to resolve a valid Auth0 user for email: ${normalizedEmail}`);
  }

  const auth0Id = auth0User.user_id;

  // --- Step 2: Check Local DB by email ---
  if (localUser) {
    const normalizedDbName = toTitleCase(localUser.name);
    if (normalizedDbName !== normalizedInputName) {
      // This is a user-fixable error.
      throw new Error(`The email "${email}" is already associated with the name "${localUser.name}". Please correct the name in the CSV and re-upload.`);
    }

    // User exists in our DB. Check if they need to be promoted.
    if (!localUser.auth0Id) {
      localUser.auth0Id = auth0Id;
      await localUser.save({ session });
    }
  } else {
    // User does not exist in our DB. Create them.
    console.log(`User not found in local DB. Creating...`);

     // First, ensure the desired name is unique in our local DB.
    const nameCollision = await User.findOne({ name: normalizedInputName }).session(session);
    let finalNameToUse = normalizedInputName;
    
    if (nameCollision) {
      finalNameToUse = await generateUniqueUsername(normalizedInputName, { session });
    }

    const createdUsers = await User.create([{ // <-- 1. Wrap in an array
      name: finalNameToUse,
      email: normalizedEmail,
      dupr: { id: duprId },
      auth0Id: auth0Id,
      isGuest: false,
    }], { session });

    localUser = createdUsers[0];
  }

  // --- Step 3: Generate Password Reset Ticket if Needed ---
  let passwordResetLink: string | undefined;
  if (needsPasswordReset) {
    console.log(`[Step 3] Generating password reset ticket for new user.`);
    const ticketResponse = await auth0.tickets.changePassword({
      user_id: auth0Id,
    });

    console.log('ticket response:', ticketResponse)
    passwordResetLink = ticketResponse.ticket;
  }

  if (!localUser || !localUser.auth0Id) {
    throw new Error("Failed to resolve a valid local user at the end of the process.");
  }

  // --- Step 4: Return Final Result ---
  return {
    originalName: name,
    user: {
      _id: localUser._id.toString(),
      name: localUser.name,
      auth0Id: localUser.auth0Id!,
    },
    passwordResetLink,
  };
}