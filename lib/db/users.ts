import User from "@/app/models/User"
import connectToDatabase from "../mongodb"
import { SessionData } from "@auth0/nextjs-auth0/types";

export async function getOrCreateAuthenticatedUser(
  auth0Id: string,
  session: SessionData | null,
  guestUserName: string | null
) {
  await connectToDatabase()

  if (guestUserName) {
    // Try to promote the guest account
    const promotedUser = await User.findOneAndUpdate(
      { name: guestUserName, auth0Id: { $exists: false } },
      {
        auth0Id,
        name: guestUserName ?? session?.user.name,
        email: session?.user.email,
      },
      {
        new: true,
        upsert: false, // Do not create if guest not found
      }
    )

    if (promotedUser) {
      return promotedUser
    }
  }

  // No guest promotion — just fetch authenticated user if it exists
  const existingUser = await User.findOne({ auth0Id })

  // ✅ Return existing user or null (do not create one)
  return existingUser
}

export async function getOrCreateGuestUser(name: string) {
  await connectToDatabase();
  
  let user = await User.findOne({
    name: new RegExp(`^${name}$`, 'i'),
    auth0Id: { $exists: false },
  })
  if (!user) {
    user = await User.create({ name })
  }
  return user
}
