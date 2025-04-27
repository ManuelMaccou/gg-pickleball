import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'
import User from '@/app/models/User'
import { escapeRegex } from '@/utils/escapeRegex'
import connectToDatabase from '@/lib/mongodb'

await connectToDatabase()

const GUEST_SECRET = process.env.GUEST_SECRET!
const secret = new TextEncoder().encode(GUEST_SECRET)

export async function POST(request: Request) {
  const { guestName } = await request.json()

  if (!guestName || typeof guestName !== 'string') {
    return NextResponse.json({ error: 'guestName is required' }, { status: 400 })
  }

  const safeName = escapeRegex(guestName.trim())

  const existing = await User.findOne({
    name: { $regex: `^${safeName}$`, $options: 'i' }
  })

  if (existing) {
    return NextResponse.json({ error: 'Name already exists. Choose a different name.' }, { status: 409 })
  }

  try {
    const newUser = new User({ name: guestName.trim() })

    const token = await new SignJWT({
      name: newUser.name,
      isGuest: true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(newUser._id.toString()) // _id exists before save
      .setExpirationTime('1 year')
      .setIssuedAt()
      .sign(secret)

    const cookieStore = await cookies()
    cookieStore.set('guestToken', token, {
      httpOnly: true,
      secure: process.env.ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })

    // Save user only if token and cookie succeeded
    await newUser.save()

    return NextResponse.json({ message: 'Guest user created', user: newUser }, { status: 201 })
  } catch (err) {
    console.error('Failed to create guest token or set cookie:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
