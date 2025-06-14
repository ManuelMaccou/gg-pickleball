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
  codes: {
    _id: string;
    code: string;
    redeemed: boolean;
    earnedAt: Date;
    redemptionDate?: Date;
  }[];
};

type ClientConfiguredReward = {
  achievementId: string;
  achievementFriendlyName: string;
  reward: IRewardWithCode;
};

type PopulatedRewardCode = Omit<IRewardCode, 'rewardId' | 'achievementId'> & {
  achievement: { _id: string; friendlyName: string };
};

type Props = {
  user: FrontendUser | null;
  location: IClient;
  variant?: 'preview' | 'full';
  maxCount?: number;
};

export default function RewardsGrid({ user, location, maxCount }: Props) {
  const [fetchingRewards, setFetchingRewards] = useState<boolean>(false);
  const [allUserEarnedRewards, setAllUserEarnedRewards] = useState<RewardWithAchievementContext[]>([]);
  const [clientConfiguredRewards, setClientConfiguredRewards] = useState<ClientConfiguredReward[]>([]);
  const [allRewards, setAllRewards] = useState<RewardWithAchievementContext[]>([]);
  const [selectedReward, setSelectedReward] = useState<{
    reward: RewardWithAchievementContext;
    instance: { redeemed: boolean; earnedAt: Date; _id: string };
  } | null>(null);

  // Get all earned reward codes for this user at this location
  useEffect(() => {
    const fetchUserRewardCodes = async () => {
      if (!user?._id || !location._id) return;

      setFetchingRewards(true);
      try {
        const res = await fetch(`/api/reward-code?userId=${user._id}&clientId=${location._id}`);
        const data = await res.json();
        const codes = data.codes as PopulatedRewardCode[];

        const rewardMap = new Map<string, RewardWithAchievementContext>();

        for (const code of codes) {
          const rewardId = code.reward._id.toString();
          const { _id: achievementId, friendlyName } = code.achievement;
          const reward = code.reward;

          if (!rewardMap.has(rewardId)) {
            rewardMap.set(rewardId, {
              ...reward,
              achievementId,
              achievementFriendlyName: friendlyName,
              codes: [],
            });
          }

          rewardMap.get(rewardId)!.codes.push({
            _id: code._id.toString(),
            code: code.code,
            redeemed: code.redeemed,
            redemptionDate: code.redemptionDate,
            earnedAt: code.createdAt,
          });
        }

        setAllUserEarnedRewards([...rewardMap.values()]);
      } catch (err) {
        console.error('Error fetching user reward codes:', err);
      } finally {
        setFetchingRewards(false);
      }
    };

    fetchUserRewardCodes();
  }, [user?._id, location._id]);

  // Get all client configured rewards
  useEffect(() => {
    const fetchClientRewards = async () => {
      if (!location._id) return;

      try {
        const res = await fetch(`/api/reward/client-rewards-achievements?clientId=${location._id}`);
        const data = await res.json();

        if (res.ok && Array.isArray(data.rewards)) {
          setClientConfiguredRewards(data.rewards);

          console.log('client config rewards:', data.rewards)

        } else {
          console.error('Error fetching client rewards:', data.error);
        }
      } catch (err) {
        console.error('Error fetching client rewards:', err);
      }
    };

    fetchClientRewards();
  }, [location._id]);

  // Merge configured + earned rewards
  useEffect(() => {
    const mergeRewards = () => {
      const mergedMap = new Map<string, RewardWithAchievementContext>();

      for (const item of clientConfiguredRewards) {
        const reward = item.reward;
        if (!reward || !reward._id) {
          console.warn('Skipping invalid reward in clientConfiguredRewards:', item);
          continue;
        }

        mergedMap.set(reward._id.toString(), {
          ...reward,
          achievementId: item.achievementId,
          achievementFriendlyName: item.achievementFriendlyName,
          codes: [],
        });
      }

      for (const earned of allUserEarnedRewards) {
        const key = earned._id.toString();
        if (mergedMap.has(key)) {
          mergedMap.get(key)!.codes = earned.codes;
        } else {
          mergedMap.set(key, earned);
        }
      }

      const mergedList = [...mergedMap.values()].sort((a, b) => {
        const aUnlocked = a.codes.some(c => !c.redeemed);
        const bUnlocked = b.codes.some(c => !c.redeemed);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return (a.index ?? Infinity) - (b.index ?? Infinity);
      });

      setAllRewards(mergedList);
    };

    if (clientConfiguredRewards.length > 0 || allUserEarnedRewards.length > 0) {
      mergeRewards();
    }
  }, [clientConfiguredRewards, allUserEarnedRewards]);

  const displayedRewards = maxCount
    ? allRewards.slice(0, maxCount)
    : allRewards;

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
