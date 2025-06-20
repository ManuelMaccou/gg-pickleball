import { auth0 } from '@/lib/auth0'
import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getOrCreateAuthenticatedUser, getOrCreateGuestUser } from '../db/users'
import { ResolvedUser } from '@/app/types/databaseTypes'

const GUEST_SECRET = process.env.GUEST_SECRET!
const secret = new TextEncoder().encode(GUEST_SECRET)

export async function getAuthorizedUser(req: NextRequest): Promise<ResolvedUser | null> {
  let session = null
  try {
    session = await auth0.getSession()
  } catch (err) {
    console.warn('⚠️ Failed to parse session:', err)
    return null
  }


  const guestToken = req.cookies.get('guestToken')?.value
  const guestUsername = req.cookies.get('guestUsername')?.value ?? null

  if (session?.user?.sub) {
    try {
      const auth0Id = session.user.sub
      const user = await getOrCreateAuthenticatedUser(auth0Id, session, guestUsername)

      return {
        id: user._id.toString(),
        name: user.name,
        email: session.user.email,
        isGuest: false,
      }
    } catch (err) {
      console.error('Failed to resolve authenticated user in API route:', err)
      return null
    }
  }

  if (guestToken) {
    try {
      const { payload } = await jwtVerify<{ name: string }>(guestToken, secret)
      const guestUser = await getOrCreateGuestUser(payload.name)

      return {
        id: guestUser._id.toString(),
        name: guestUser.name,
        isGuest: true,
      }
    } catch (err) {
      console.warn('Invalid guest token in API route:', err)
      return null
    }
  }

  return null
}