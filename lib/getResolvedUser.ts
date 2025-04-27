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
    const session = await auth0.getSession()
    const auth0Id = session?.user?.sub
    if (!auth0Id) return null

    const user = await getOrCreateAuthenticatedUser(auth0Id, session, guestUsername)
    return {
      id: user._id.toString(),
      name: user.name,
      email: session.user.email,
      isGuest: false
    }
  }

  if (userType === 'guest') {
    if (!guestUsername) return null
    const user = await getOrCreateGuestUser(guestUsername)
    return {
      id: user._id.toString(),
      name: user.name,
      isGuest: true
    }
  }

  // First time visitor or unknown
  return null
}
