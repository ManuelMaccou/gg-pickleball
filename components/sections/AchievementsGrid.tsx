'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Flex, Spinner, Text } from '@radix-ui/themes'
import Image from 'next/image'
import { AchievementData, IAchievement } from '@/app/types/databaseTypes'

type Props = {
  clientId: string
  earnedAchievements: AchievementData[]
  variant?: 'full' | 'preview'
  maxCount?: number
}

export default function AchievementsGrid({
  clientId,
  earnedAchievements,
  variant = 'full',
  maxCount,
}: Props) {
  const [allClientAchievements, setAllClientAchievements] = useState<IAchievement[]>([])
  const [isFetchingAchievements, setIsFetchingAchievements] = useState<boolean>(false)

  useEffect(() => {
    const fetchClientAchievements = async () => {
      if (!clientId) return;

      setIsFetchingAchievements(true)

      try {
        const res = await fetch(`/api/client/achievements?clientId=${clientId}`);
        if (!res.ok) {
          console.error('Failed to fetch client achievements:', res.statusText);
          return;
        }

        const data = await res.json();

        const sortedAchievements = (data.achievements || []).sort(
          (a: IAchievement, b: IAchievement) => a.index - b.index
        );

        setAllClientAchievements(sortedAchievements);
      } catch (error) {
        console.error('Error fetching client achievements:', error);
      } finally {
        setIsFetchingAchievements(false)
      }
    };

    fetchClientAchievements();
  }, [clientId]);

  const earnedAchievementMap = useMemo(() => {
    const map = new Map<string, { count: number }>();
    for (const a of earnedAchievements) {
      map.set(a.name, { count: a.count ?? 1 });
    }
    return map;
  }, [earnedAchievements]);

  const displayedAchievements = maxCount
    ? allClientAchievements.slice(0, maxCount)
    : allClientAchievements

  if (isFetchingAchievements) return (
    <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
       <Spinner size={'3'} style={{color: 'white'}} />
    </Flex>
  )

  if (!isFetchingAchievements && allClientAchievements.length === 0) return (
    <Card>
      <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
        <Text color='gray' size={'3'} align={'center'}>Achievements not configured. Please contact the facility.</Text>
      </Flex>
    </Card>
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
            key={achievement._id.toString()}
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
                overflow: 'auto',
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
            {earnedCount && earnedCount > 1 && (
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
