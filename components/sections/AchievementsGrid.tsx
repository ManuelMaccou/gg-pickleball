'use client'

import { useEffect, useState } from 'react'
import { Flex, Text } from '@radix-ui/themes'
import Image from 'next/image'

type EarnedAchievement = {
  name: string
  count: number
  earnedAt: Date[]
}

type Achievement = {
  _id: string
  name: string
  friendlyName: string
  badge: string
}

type Props = {
  earnedAchievements: EarnedAchievement[]
  variant?: 'full' | 'preview'
  maxCount?: number
}

export default function AchievementsGrid({
  earnedAchievements,
  variant = 'full',
  maxCount,
}: Props) {
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    const fetchAchievements = async () => {
      const res = await fetch('/api/achievement')
      const data = await res.json()
      setAllAchievements(data.achievements || [])
    }

    fetchAchievements()
  }, [])

  const displayedAchievements = maxCount
    ? allAchievements.slice(0, maxCount)
    : allAchievements

    const userHasAchievement = (name: string) =>
      earnedAchievements.some((a) => a.name === name)

  return (
    <Flex
      wrap="wrap"
      gap="4"
      justify="center"
      style={{
        maxWidth: variant === 'preview' ? '100%' : '600px',
      }}
    >
      {displayedAchievements.map((achievement) => {
        const isEarned = userHasAchievement(achievement.name)
        const earnedData = earnedAchievements.find((a) => a.name === achievement.name)
        const earnedCount = earnedData?.count || 0

        return (
          <div
            key={achievement._id}
            style={{
              width: '25%',
              textAlign: 'center',
              transition: 'filter 0.3s ease',
            }}
          >
            <div
              style={{
                filter: isEarned ? 'none' : 'grayscale(100%) brightness(0.6)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <Image
                src={achievement.badge}
                alt={achievement.friendlyName}
                width={500}
                height={500}
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        )
      })}
    </Flex>
  )
}
