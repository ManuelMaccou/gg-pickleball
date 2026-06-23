import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import crypto from 'crypto'
import { logError } from '@/lib/sentry/logger';

export async function GET() {
  try {
    const guestSecret = process.env.GUEST_SECRET;
    if (!guestSecret) {
      console.error('[GuestToken] Missing GUEST_SECRET env var');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const secret = new TextEncoder().encode(guestSecret);
    const nonce = crypto.randomUUID();

    const token = await new SignJWT({ nonce })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('20secs')
      .sign(secret);

    return NextResponse.json({ token });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/user/guest/request-token' });
    return NextResponse.json({ error: 'Failed to create token', errorId }, { status: 500 });
  }
}
