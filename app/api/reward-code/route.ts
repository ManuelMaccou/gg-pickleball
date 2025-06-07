import connectToDatabase from '@/lib/mongodb'
import RewardCode from '@/app/models/RewardCode'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/sentry/logger'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const clientId = searchParams.get('clientId')

  try {
    await connectToDatabase()

    if (!userId || !clientId) {
      return NextResponse.json({ error: 'Missing userId or clientId' }, { status: 400 })
    }

    const codes = await RewardCode.find({ userId, clientId })

    return NextResponse.json({ codes })
  } catch (error) {
    logError(error, {
      message: `Error fetching reward codes`,
      userId: userId,
      clientId: clientId,
    });

    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
