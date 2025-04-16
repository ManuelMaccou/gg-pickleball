// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { auth0 } from "./lib/auth0"

export async function middleware(request: NextRequest) {
  // Run the default Auth0 middleware
  const response = await auth0.middleware(request)
  const guestCookie = request.cookies.get('userName')

  // Determine if the user is a guest or authenticated
  const session = await auth0.getSession();
  const isGuest = !session && Boolean(guestCookie)

  if (session) {
    response.headers.set('x-user-type', 'authenticated')
  } else if (isGuest) {
    response.headers.set('x-user-type', 'guest')
    response.headers.set('x-guest-username', guestCookie?.value || '')
  } else {
    response.headers.set('x-user-type', 'first-vistor')
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
