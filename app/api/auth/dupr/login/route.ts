import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logError } from '@/lib/sentry/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userToken, refreshToken } = body;

    if (!userToken || !refreshToken) {
      return NextResponse.json({ message: 'Missing tokens' }, { status: 400 });
    }

    const cookieStore = await cookies();

    // The access token is needed for API calls. Expiry is typically short (e.g., 1 hour).
    // Set httpOnly to true for better security.
    cookieStore.set('dupr-user-token', userToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60, // 1 hour in seconds
    });

    // The refresh token has a much longer life. It's highly sensitive.
    // httpOnly is CRITICAL here.
    cookieStore.set('dupr-user-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
    });

    return NextResponse.json({ message: 'Authentication successful' });

  } catch (error) {
    console.error("Error saving tokens:", error);
    const errorId = logError(error, { endpoint: 'POST /api/auth/dupr/login' });
    return NextResponse.json({ errorId, message: 'Internal server error' }, { status: 500 });
  }
}