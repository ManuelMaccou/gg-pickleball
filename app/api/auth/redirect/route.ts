// app/api/auth/redirect/route.ts
//
// Post-login redirect router. Called via returnTo=/api/auth/redirect
// after Auth0 authentication completes.
//
// Routes:
//   superAdmin        → /admin/gg/config
//   brand admin       → /admin/brand
//   player (default)  → /play

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const user = await getAuthorizedUser(req);

    if (!user) {
      return NextResponse.redirect(`${BASE_URL}/auth/login`);
    }

    if (user.superAdmin) {
      return NextResponse.redirect(`${BASE_URL}/admin/gg/config`);
    }

    if (user.adminLocationId) {
      return NextResponse.redirect(`${BASE_URL}/admin/brand`);
    }

    return NextResponse.redirect(`${BASE_URL}/play`);
  } catch {
    return NextResponse.redirect(`${BASE_URL}/play`);
  }
}