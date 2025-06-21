import connectToDatabase from '@/lib/mongodb'
import RewardCode from '@/app/models/RewardCode'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/sentry/logger'
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser'

export async function GET(req: NextRequest) {

  const user = await getAuthorizedUser(req)
  console.log('authd user:', user)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const clientId = searchParams.get('clientId')

  try {
    await connectToDatabase()

    if (!userId || !clientId) {
      return NextResponse.json({ error: 'Missing userId or clientId' }, { status: 400 })
    }

    const response = await RewardCode.find({ userId, clientId })
    .populate('achievementId')

    const codes = response.map(code => ({
      ...code.toObject(),
      achievement: code.achievementId,
    }));

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
