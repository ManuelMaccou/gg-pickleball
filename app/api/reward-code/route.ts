// app/api/reward-code/route.ts
import connectToDatabase from '@/lib/mongodb'
import RewardCode from '@/app/models/RewardCode'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const clientId = searchParams.get('clientId')

    if (!userId || !clientId) {
      return NextResponse.json({ error: 'Missing userId or clientId' }, { status: 400 })
    }

    const codes = await RewardCode.find({ userId, clientId })

    return NextResponse.json({ codes })
  } catch (error) {
    console.error('Failed to fetch reward codes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
