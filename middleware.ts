import { NextRequest, NextResponse } from "next/server"
import { auth0 } from "./lib/auth0"
import { jwtVerify } from 'jose'

const GUEST_SECRET = process.env.GUEST_SECRET!
const secret = new TextEncoder().encode(GUEST_SECRET)

export async function middleware(request: NextRequest) {
  const response = await auth0.middleware(request)

  const session = await auth0.getSession(request);
  const guestToken = request.cookies.get('guestToken')?.value

  let guestUserName: string | null = null

  if (guestToken) {
    try {
      const { payload } = await jwtVerify<{ name: string }>(guestToken, secret)
      guestUserName = payload.name
    } catch (err) {
      console.warn('Invalid guest token:', err)
    }
  }

  const isGuest = !session && Boolean(guestUserName)

  if (session) {
    if (guestToken && guestUserName) {
      response.headers.set('x-guest-username', guestUserName)
    }
    response.headers.set('x-user-type', 'authenticated')

  } else if (isGuest) {
    response.headers.set('x-user-type', 'guest')
    response.headers.set('x-guest-username', guestUserName || '')

  } else {
    response.headers.set('x-user-type', 'first-visitor')
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
