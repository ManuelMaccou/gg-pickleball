// Added session support — processPlayersUpload.ts
// now wraps each row in a transaction alongside reconciliation's reads and
// the identityUnresolved-flagging/issue-creation path, and this function's
// own local DB operations (the dedup read, the User.create write) need to
// participate in that same transaction. The Auth0 call itself can't be
// transactional with Mongo — different systems — same as e.g. Shopify
// calls elsewhere never being part of a Mongo transaction either; that's
// expected, not a gap.
//
// Mongoose gotcha worth noting: passing `session` via options requires
// wrapping the document in an array — `User.create([doc], { session })` —
// not `User.create(doc, { session })`, which doesn't reliably thread the
// session through. Hence the array wrap and `newUser[0]` below.

import { ManagementClient } from 'auth0';
import { ClientSession } from 'mongoose';
import User from '@/app/models/User';

interface FindOrCreatePlayerAccountParams {
  duprId: string;
  name: string;
  email: string;
}

interface FindOrCreatePlayerAccountOptions {
  session?: ClientSession;
}

interface FindOrCreatePlayerAccountResult {
  userId: string;
  created: boolean; // false if an account already existed for this DUPR ID
}

export async function findOrCreatePlayerAccount(
  { duprId, name, email }: FindOrCreatePlayerAccountParams,
  options: FindOrCreatePlayerAccountOptions = {}
): Promise<FindOrCreatePlayerAccountResult> {
  const { session } = options;

  // 1. Skip if a Player Account already exists for this DUPR ID.
  // [Identity reconciliation] Redundant now — reconcilePlayerIdentity
  // already confirmed neither email nor DUPR ID matches anything before
  // this function is ever called with a 'create_new' outcome — but left
  // in place as a harmless defensive backstop, and to keep this function
  // safe to call standalone from anywhere else that might not reconcile
  // first.
  const existingQuery = User.findOne({ 'dupr.id': duprId });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) {
    return { userId: existing._id.toString(), created: false };
  }

  const auth0 = new ManagementClient({
    domain: process.env.AUTH0_ISSUER_BASE_URL!,
    clientId: process.env.AUTH0_M2M_CLIENT_ID!,
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
  });

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // 2. Create the Auth0 identity.
  let auth0Id: string;
  try {
    const auth0NewUser = await auth0.users.create({
      connection: 'GG-Pickleball',
      email: normalizedEmail,
      name: cleanName,
      password: Math.random().toString(36).slice(-16),
      email_verified: false,
    });
    const newUserId = auth0NewUser.data?.user_id || (auth0NewUser as any).user_id;
    if (!newUserId) throw new Error('Auth0 failed to return a user_id');
    auth0Id = newUserId;
  } catch (auth0Error: any) {
    if (auth0Error.statusCode === 409) {
      // Email already exists in Auth0 under this connection — e.g. this
      // person has some other account/context under the same email, even
      // though no local User matched on DUPR ID. Reuse the existing Auth0
      // identity rather than failing the row. (This also self-heals a
      // partial-failure retry: if a prior attempt created the Auth0 user
      // but then failed before the local User.create() below, re-running
      // this same row lands here and picks up the orphaned Auth0 id.)
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

  const newUser = await User.create(
    [{
      name: cleanName,
      email: normalizedEmail,
      auth0Id,
      dupr: { id: duprId },
      accountClaimed: false,
    }],
    { session }
  );

  return { userId: newUser[0]._id.toString(), created: true };
}