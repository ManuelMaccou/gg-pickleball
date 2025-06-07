import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Client from '@/app/models/Client'
import Reward from '@/app/models/Reward'
import Achievement from '@/app/models/Achievement'
import { Types } from 'mongoose'
import { logError } from '@/lib/sentry/logger'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  try {
    await connectToDatabase()

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
    }

    const client = await Client.findById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const rewardsPerAchievement = client.rewardsPerAchievement ?? new Map()
    const entries = Array.from(rewardsPerAchievement.entries()) as [string, Types.ObjectId][];

    if (entries.length === 0) {
      return NextResponse.json({ rewards: [] })
    }

    const rewardIds = entries.map(([, rewardId]) => rewardId)
    const achievementNames = entries.map(([achievementName]) => achievementName);

    const [rewards, achievements] = await Promise.all([
      Reward.find({ _id: { $in: rewardIds } }),
      Achievement.find({ name: { $in: achievementNames } })
    ])

    const result = entries.map(([achievementName, rewardId]) => {
      const reward = rewards.find(r => r._id.toString() === rewardId.toString())
      const achievement = achievements.find(a => a.name === achievementName)

      if (!reward || !achievement) return null

      return {
        achievementId: achievement._id.toString(),
        achievementFriendlyName: achievement.friendlyName,
        reward
      }
    }).filter(Boolean)

    return NextResponse.json({ rewards: result })
  } catch (error) {
    logError(error, {
      message: `Error fetching client's configured rewards`,
      clientId: clientId,
    });
    
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
