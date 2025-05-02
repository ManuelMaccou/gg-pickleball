'use client'

import { useEffect, useState } from 'react'
import { Card, Text, Flex, Box, Badge, Spinner } from '@radix-ui/themes'
import Image from 'next/image'
import { IClient, IReward } from '@/app/types/databaseTypes'
import RedeemRewardsDialog from '../RedeemRewardsDialog'
import { FrontendUser } from '@/app/types/frontendTypes'

type Props = {
  user: FrontendUser | null
  location: IClient
  unlockedRewardIds: string[]
  variant?: 'preview' | 'full'
  maxCount?: number
}

export default function RewardGrid({ user, location, unlockedRewardIds, maxCount }: Props) {
  const [allRewards, setAllRewards] = useState<IReward[]>([])
  const [selectedReward, setSelectedReward] = useState<IReward | null>(null)

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

  if (allRewards.length === 0) return (
    <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
        <Spinner size={'3'} style={{color: 'white'}} />
    </Flex>
  )

  return (
    <Flex direction={'column'} gap="4">
      {displayedRewards.map((reward) => {
       const isUnlocked = unlockedRewardIds.includes(reward._id.toString());
        const cardContent = (
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
                  src={location.icon}
                  alt={''}
                  height={200}
                  width={200}
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
        )

        return (
          <Flex direction="column" key={reward._id.toString()}>
            {isUnlocked ? (
              <div onClick={() => setSelectedReward(reward)}>{cardContent}</div>
            ) : (
              cardContent
            )}
          </Flex>
        )
      })}

      {selectedReward && (
        <RedeemRewardsDialog
          showRedeemRewardsDialog={true}
          setShowRedeemRewardsDialog={(open) => {
            if (!open) setSelectedReward(null)
          }}
          reward={selectedReward}
          location={location}
          user={user}
        />
      )}
    </Flex>
  )
}
