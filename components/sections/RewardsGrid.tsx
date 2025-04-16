'use client'

import { useEffect, useState } from 'react'
import { Card, Text, Flex, Box, Badge } from '@radix-ui/themes'
import Image from 'next/image'
import { IReward } from '@/app/types/databaseTypes'

type Props = {
  earnedAchievements: string[]
  variant?: 'preview' | 'full'
  maxCount?: number
}

export default function RewardGrid({ earnedAchievements, variant = 'full', maxCount }: Props) {
  const [allRewards, setAllRewards] = useState<IReward[]>([])

  useEffect(() => {
    const fetchRewards = async () => {
      const res = await fetch('/api/reward')
      const data = await res.json()
      setAllRewards(data.rewards || [])
    }

    fetchRewards()
  }, [])

  const displayedRewards = maxCount
    ? allRewards.slice(0, maxCount)
    : allRewards

  return (
    <Flex
      direction={'column'}
      gap="4"
      
    >
      {displayedRewards.map((reward) => {
        const isUnlocked = earnedAchievements.includes(reward.achievement)

        return (
          <Flex direction={'column'} key={reward._id.toString()}>
          <Card
            style={{
              filter: isUnlocked ? 'none' : 'grayscale(100%) brightness(0.6)',
              transition: 'filter 0.3s ease',
              padding: '1rem',
              borderStyle: isUnlocked ? 'solid' : undefined,
              borderWidth: isUnlocked ? '1px' : undefined,
              borderColor: isUnlocked ? '#FFEA00' : undefined,
              borderRadius: isUnlocked ? '10px' : undefined
            }}
          >
            <Flex direction={'row'} gap={'6'}>
              <Box position={'relative'}>
                <Image
                  src={'/partnerLogos/PowerPlayPB_icon.png'}
                  alt={''}
                  height={702}
                  width={380}
                  style={{maxWidth: '50px', height: 'auto'}}
                  />
              </Box>
              <Flex direction={'column'} justify={'center'}>
                <Text size={'5'} weight={'bold'}  color={isUnlocked ? undefined : 'gray'}
                  style={{ textTransform: 'uppercase' }}
                >
                  {reward.discount}
                </Text>
                <Text size={'4'} color={isUnlocked ? undefined : 'gray'}
                  style={{ textTransform: 'uppercase' }}
                >{
                  reward.product}
                </Text>
              </Flex>
              {isUnlocked && (
                <Flex direction={'row'} justify={'end'} align={'center'} flexGrow={'1'}>
                  <Badge variant='solid'>Activated</Badge>
                </Flex>
              )}
              
            </Flex>
            
             
            

            
            
          </Card>
          </Flex>
        )
      })}
    </Flex>
  )
}
