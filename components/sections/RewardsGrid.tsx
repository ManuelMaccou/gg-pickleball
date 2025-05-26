'use client'

import { useEffect, useState } from 'react'
import { Card, Text, Flex, Box, Badge, Spinner } from '@radix-ui/themes'
import Image from 'next/image'
import { IClient, IRewardCode } from '@/app/types/databaseTypes'
import RedeemRewardsDialog from '../RedeemRewardsDialog'
import { FrontendUser } from '@/app/types/frontendTypes'
import { IRewardWithCode } from '@/app/types/rewardTypes'

type RewardWithAchievementContext = IRewardWithCode & {
  achievementId: string;
  achievementFriendlyName: string;
};

type RewardApiResponseEntry = {
  achievementId: string;
  achievementFriendlyName: string;
  reward: IRewardWithCode;
};

type Props = {
  user: FrontendUser | null
  location: IClient
  unlockedRewardIds: string[]
  earnedRewards: { rewardId: string; redeemed: boolean; earnedAt: Date; _id: string }[]
  variant?: 'preview' | 'full'
  maxCount?: number
}

export default function RewardGrid({ user, location, maxCount }: Props) {
  const [fetchingRewards, setFetchingRewards] = useState<boolean>(false);
  const [allRewards, setAllRewards] = useState<RewardWithAchievementContext[]>([])
  const [selectedReward, setSelectedReward] = useState<{
    reward: RewardWithAchievementContext;
    instance: { rewardId: string; redeemed: boolean; earnedAt: Date; _id: string };
  } | null>(null);

  useEffect(() => {
    const fetchRewardsAndCodes = async () => {
      if (!location._id) return;

      setFetchingRewards(true);

      try {
        const rewardsRes = await fetch(`/api/reward/client-rewards-achievements?clientId=${location._id}`);
        const rewardsData = await rewardsRes.json();

        let codesData: { codes: IRewardCode[] } = { codes: [] };

        // Only fetch codes if a user exists
        if (user?._id) {
          const codesRes = await fetch(`/api/reward-code?userId=${user._id}&clientId=${location._id}`);
          codesData = await codesRes.json();

          (codesData.codes || []).forEach((code: IRewardCode, index: number) => {
            if (typeof code.rewardId !== 'string' && typeof code.rewardId !== 'object') {
              console.warn(`⚠️ Invalid rewardId at index ${index}:`, code.rewardId, code);
            }
          });
        }

        // Combine codes into rewards
        const rewardsWithCodes: RewardWithAchievementContext[] = (rewardsData.rewards || []).map(
          (entry: RewardApiResponseEntry) => {
            const { reward, achievementId, achievementFriendlyName } = entry;

            const matchingCodes = (codesData.codes || []).filter(
              (code: IRewardCode) => code.rewardId.toString() === reward._id.toString()
            );

            return {
              ...reward,
              achievementId,
              achievementFriendlyName,
              codes: matchingCodes.map((code: IRewardCode) => ({
                _id: code._id.toString(),
                rewardId: code.rewardId.toString(),
                code: code.code,
                redeemed: code.redeemed,
                redemptionDate: code.redemptionDate,
                earnedAt: code.createdAt,
              })),
            };
          }
        );

        const sortedRewards = rewardsWithCodes.sort((a, b) => {
          const aUnlocked = a.codes?.some((c) => !c.redeemed) ?? false;
          const bUnlocked = b.codes?.some((c) => !c.redeemed) ?? false;

          if (aUnlocked && !bUnlocked) return -1;
          if (!aUnlocked && bUnlocked) return 1;

          return (a.index ?? Infinity) - (b.index ?? Infinity);
        });

        setAllRewards(sortedRewards);
      } catch (err) {
        console.error('Failed to fetch rewards or codes:', err);
      } finally {
        setFetchingRewards(false);
      }
    };

    fetchRewardsAndCodes();
  }, [user?._id, location._id]);



  const displayedRewards = maxCount
    ? allRewards.slice(0, maxCount)
    : allRewards

  if (fetchingRewards) return (
    <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
        <Spinner size={'3'} style={{color: 'white'}} />
    </Flex>
  )

  return (
    <Flex direction={'column'} gap="4">
      {displayedRewards.map((reward) => {
        const unredeemedCount = reward.codes?.filter(c => !c.redeemed).length ?? 0;
        const isUnlocked = unredeemedCount > 0;

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
            <Flex direction={'row'} justify={'between'}>
              <Flex direction={'row'} gap={'3'}>
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
                  {reward.friendlyName}
                </Text>
                <Text size={'4'} color={isUnlocked ? undefined : 'gray'}
                  style={{ textTransform: 'uppercase' }}
                >
                  {reward.product}
                </Text>
              </Flex>

              </Flex>
              
              {isUnlocked ? (
                <Flex direction={'row'} justify={'end'} align={'center'} flexGrow={'1'}>
                  <Badge variant='solid' size={'3'}>
                    Activated{unredeemedCount > 1 ? ` x${unredeemedCount}` : ""}
                  </Badge>
                </Flex>
              ) : (
                <Flex direction={'column'} justify={'center'} align={'end'} maxWidth={'150px'}>
                  <Text align={'right'} wrap={'pretty'}>Earn {reward.achievementFriendlyName.toLowerCase()} achievement</Text>
                </Flex>
              )}
            </Flex>
          </Card>
        )

        return (
          <Flex direction="column" key={reward._id.toString()}>
            {isUnlocked ? (
              <div
                onClick={() => {
                  const earnedInstances = (reward.codes ?? [])
                    .filter(c => !c.redeemed)
                    .sort((a, b) => new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime());

                  if (earnedInstances.length > 0) {
                    const instance = earnedInstances[0];
                    setSelectedReward({
                      reward,
                      instance: {
                        rewardId: instance.rewardId,
                        redeemed: instance.redeemed,
                        earnedAt: instance.earnedAt,
                        _id: instance._id,
                      }
                    });
                  }
                }}
              >
                {cardContent}
              </div>
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
          reward={selectedReward.reward}
          earnedInstance={selectedReward.instance}
          location={location}
        />
      )}
    </Flex>
  )
}
