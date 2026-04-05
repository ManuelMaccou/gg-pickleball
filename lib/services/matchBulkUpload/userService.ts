import User from '@/app/models/User';
import { IUser } from '@/app/types/databaseTypes';
import { Auth0User } from '@/app/types/auth0Types';
import { generateUniqueUsername } from '@/utils/generateUniqueUsername';
import { ManagementClient } from 'auth0';
import { ClientSession } from 'mongoose';

interface UserCreationResult {
  originalName: string;
  user: { _id: string; name: string; auth0Id: string; };
  passwordResetLink?: string;
}

type RequiredDbOptions = { session: ClientSession };

// --- 1. GLOBAL CACHE FOR MANAGEMENT TOKEN ---
let managementToken: string | null = null;
let managementTokenExpiry: number = 0;

// Initialize Auth0 Management Client
const auth0 = new ManagementClient({
  domain: process.env.AUTH0_ISSUER_BASE_URL!,
  clientId: process.env.AUTH0_M2M_CLIENT_ID!,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
});

// --- 2. HELPER: DELAY ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- 3. UPDATED TOKEN FETCH (CACHED) ---
async function getManagementApiToken(): Promise<string> {
  // Return cached token if valid (with 5 min buffer)
  if (managementToken && Date.now() < managementTokenExpiry - 300000) {
    return managementToken;
  }

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

  if (!response.ok) {
    throw new Error('Failed to get Auth0 Management API token.');
  }

  const data = await response.json();
  managementToken = data.access_token;
  // Set expiry based on response (usually 86400s) or default to 24h
  const expiresIn = data.expires_in || 86400; 
  managementTokenExpiry = Date.now() + (expiresIn * 1000);

  return managementToken!;
}

// --- 4. HELPER: FETCH WITH RETRY (HANDLES 429) ---
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    
    if (res.status === 429) {
      const waitTime = (i + 1) * 1000; // Linear backoff: 1s, 2s, 3s...
      console.warn(`Auth0 429 Rate Limit. Retrying in ${waitTime}ms...`);
      await delay(waitTime);
      continue;
    }
    
    return res;
  }
  throw new Error(`Auth0 Request failed after ${retries} retries.`);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

  let auth0Id: string | undefined;
  let needsPasswordReset = false;

  let localUser: IUser | null = await User.findOne({
    email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
  }).session(session);

  // --- VALIDATE NAME MATCH ---
  if (localUser) {
    const normalizedDbName = toTitleCase(localUser.name);
    if (normalizedDbName !== normalizedInputName) {
      throw new Error(`The email "${email}" is already associated with the name "${localUser.name}". Please correct the name in the CSV and re-upload.`);
    }
  }

  // --- OPTIMIZATION: SKIP AUTH0 SEARCH IF LINKED LOCALLY ---
  if (localUser && localUser.auth0Id) {
    auth0Id = localUser.auth0Id;
    
    // Check if they need a reset link (Account not claimed yet)
    if (!localUser.accountClaimed) {
        console.log(`User ${localUser.email} exists but hasn't claimed account. Generating reset link.`);
        needsPasswordReset = true;
    }
  } else {
    // We MUST search/create in Auth0
    const token = await getManagementApiToken();

    // Use Retry Wrapper
    const response = await fetchWithRetry(
      `https://${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users-by-email?email=${encodeURIComponent(normalizedEmail)}`,
      {
        headers: { authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Auth0 API request failed with status: ${response.status}`);
    }

    const usersByEmail: Auth0User[] = await response.json();
    
    if (usersByEmail.length > 0) {
      auth0Id = usersByEmail[0].user_id;
      console.log(`Found existing Auth0 user: ${auth0Id}`);
    } else {
      console.log(`User not found in Auth0. Creating...`);
      
      // Use retry mechanism logic for creation if possible, or simple delay
      // Since ManagementClient doesn't support easy retries, we assume creation is less frequent
      // or wrap it if needed. For now, simple creation is usually fine if searches are cached.
      const auth0NewUser = await auth0.users.create({
        connection: 'GG-Pickleball',
        email: normalizedEmail,
        name: normalizedInputName,
        password: Math.random().toString(36).slice(-12),
        email_verified: true,
      });

      if (!auth0NewUser.user_id) throw new Error("Auth0 user creation failed.");
      
      auth0Id = auth0NewUser.user_id;
      needsPasswordReset = true;
    }
  }

  if (!auth0Id) {
    throw new Error(`Failed to resolve auth0Id for ${normalizedEmail}`);
  }

  // --- Step 2: Check/Update Local DB ---
  if (localUser) {
    if (!localUser.auth0Id) {
      localUser.auth0Id = auth0Id;
      await localUser.save({ session });
    }
  } else {
    console.log(`User not found in local DB. Creating...`);
    
    const nameCollision = await User.findOne({ name: normalizedInputName }).session(session);
    let finalNameToUse = normalizedInputName;
    
    if (nameCollision) {
      finalNameToUse = await generateUniqueUsername(normalizedInputName, { session });
    }

    const createdUsers = await User.create([{ 
      name: finalNameToUse,
      email: normalizedEmail,
      dupr: { id: duprId },
      auth0Id: auth0Id,
      isGuest: false,
      accountClaimed: false,
    }], { session });

    localUser = createdUsers[0];
  }

  // --- Step 3: Generate Password Reset Ticket ---
  let passwordResetLink: string | undefined;
  if (needsPasswordReset) {
    try {
        console.log(`[Step 3] Generating password reset ticket for ${auth0Id}.`);
        
        // Manually implement retry loop for the Ticket Generation call
        let ticketResponse;
        for (let i = 0; i < 3; i++) {
            try {
                ticketResponse = await auth0.tickets.changePassword({ user_id: auth0Id });
                break; // Success
            } catch (err: any) {
                if (err.statusCode === 429) {
                    const wait = (i + 1) * 1000;
                    console.log(`Rate limited on ticket generation. Waiting ${wait}ms...`);
                    await delay(wait);
                    continue;
                }
                throw err;
            }
        }
        
        if (ticketResponse) {
            passwordResetLink = ticketResponse.ticket;
        }
    } catch (e) {
        console.error("Failed to generate password reset ticket:", e);
        // Don't crash the upload if just the ticket fails, user can reset manually
    }
  }

  return {
    originalName: name,
    user: {
      _id: localUser!._id.toString(),
      name: localUser!.name,
      auth0Id: localUser!.auth0Id!,
    },
    passwordResetLink,
  };
}