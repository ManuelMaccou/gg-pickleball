import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import crypto from 'crypto'

const secret = new TextEncoder().encode(process.env.GUEST_SECRET!)

export async function GET() {
  const nonce = crypto.randomUUID()

  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('20secs')
    .sign(secret)

  return NextResponse.json({ token })
}
