import { auth0 } from '@/lib/auth0'
import { headers } from 'next/headers'
import { getOrCreateGuestUser, getOrCreateAuthenticatedUser } from './db/users'

export type ResolvedUser = {
  id: string
  name: string
  email?: string
  isGuest: boolean
}

export async function getResolvedUser(): Promise<ResolvedUser | null> {

  const headerList = await headers()
  const userType = headerList.get('x-user-type')
  const guestUsername = headerList.get('x-guest-username')

  if (userType === 'authenticated') {
    try {
      const session = await auth0.getSession()
      const auth0Id = session?.user?.sub
      if (!auth0Id) {
        console.warn('Authenticated user missing auth0Id')
        return null
      }

      const user = await getOrCreateAuthenticatedUser(auth0Id, session, guestUsername)
      return {
        id: user._id.toString(),
        name: user.name,
        email: session.user.email,
        isGuest: false
      }
    } catch (err) {
      console.error('Failed to resolve authenticated user:', err)
      return null
    }
  }

  if (userType === 'guest') {
    if (!guestUsername) {
      console.warn('Guest user missing guestUsername header')
      return null
    }

    try {
      const user = await getOrCreateGuestUser(guestUsername)
      return {
        id: user._id.toString(),
        name: user.name,
        isGuest: true
      }
    } catch (err) {
      console.error('Failed to resolve guest user:', err)
      return null
    }
  }

  // First-time visitor or unknown user type
  return null

}
