import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/app/models/User'

export async function POST(req: NextRequest) {

  console.log('Started new user creation API');

  const apiKey = req.headers.get('x-api-key')

   console.log('API key:', apiKey);
   
  if (apiKey !== process.env.AUTH0_ACTION_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sub, email, name } = body

  if (!sub || !email || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await connectToDatabase() // if you're not already connected globally

    // Check if user already exists
    const existing = await User.findOne({ auth0Id: sub })
    if (existing) {
      return NextResponse.json({ message: 'User already exists' }, { status: 200 })
    }

    const newUser = new User({
      auth0Id: sub,
      email,
      name,
      isGuest: false,
      createdAt: new Date(),
    })

    await newUser.save()

    return NextResponse.json({ success: true }, { status: 201 })

  } catch (err) {
    console.error('Error creating user:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
