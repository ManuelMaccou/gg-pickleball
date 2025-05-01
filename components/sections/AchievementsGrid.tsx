'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Flex, Spinner } from '@radix-ui/themes'
import Image from 'next/image'

type EarnedAchievement = {
  name: string
  count?: number
  earnedAt: Date[]
}

type Achievement = {
  _id: string
  name: string
  friendlyName: string
  badge: string
}

type Props = {
  clientId: string
  earnedAchievements: EarnedAchievement[]
  variant?: 'full' | 'preview'
  maxCount?: number
}

export default function AchievementsGrid({
  clientId,
  earnedAchievements,
  variant = 'full',
  maxCount,
}: Props) {
  const [allClientAchievements, setAllClientAchievements] = useState<Achievement[]>([])

useEffect(() => {
  const fetchClientAchievements = async () => {
    if (!clientId) return;

    try {
      const res = await fetch(`/api/client/achievements?clientId=${clientId}`);
      if (!res.ok) {
        console.error('Failed to fetch client achievements:', res.statusText);
        return;
      }

      const data = await res.json();
      setAllClientAchievements(data.achievements || []);
    } catch (error) {
      console.error('Error fetching client achievements:', error);
    }
  };

  fetchClientAchievements();
}, [clientId]);

  const earnedAchievementMap = useMemo(() => {
    return new Map(earnedAchievements.map((a) => [a.name, a]));
  }, [earnedAchievements]);

  const displayedAchievements = maxCount
    ? allClientAchievements.slice(0, maxCount)
    : allClientAchievements

  if (allClientAchievements.length === 0) return (
    <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
       <Spinner size={'3'} style={{color: 'white'}} />
    </Flex>
  )

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
        const earnedData = earnedAchievementMap.get(achievement.name);
        const isEarned = Boolean(earnedData);
        const earnedCount = earnedData?.count;

        return (
          <div
            key={achievement._id}
            style={{
              position: 'relative',
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
            {earnedCount && (
                <Badge 
                size={'3'}
                radius='full'
                color='red'
                variant='solid'
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  padding: '4px 8px',
                  fontWeight: 'bold',
                  zIndex: 1,
                }}
              >
                {earnedCount}
              </Badge>
              )}
          </div>
        )
      })}
    </Flex>
  )
}
