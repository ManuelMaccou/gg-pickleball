'use client'

import { useEffect, useState } from 'react'
import { Card, Text, Flex, Box, Badge, Spinner } from '@radix-ui/themes'
import Image from 'next/image'
import { IClient, IRewardCode } from '@/app/types/databaseTypes'
import RedeemRewardsDialog from '../RedeemRewardsDialog'
import { FrontendUser } from '@/app/types/frontendTypes'
import { IRewardWithCode } from '@/app/types/rewardTypes'
import { achievementKeyToFunctionName } from '@/lib/achievements/definitions'
import { achievementFunctionMetadata } from '@/lib/achievements/achievementMetadata'

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
  achievement: { _id: string; friendlyName: string; name: string };
};

type Props = {
  user: FrontendUser | null;
  location: IClient;
  variant?: 'preview' | 'full';
  maxCount?: number;
};

export default function RewardsGrid({ user, location, maxCount }: Props) {
  const [fetchingRewards, setFetchingRewards] = useState<boolean>(true);
  const [filteringRewards, setFilteringRewards] = useState<boolean>(true);
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
          const reward = code.reward;
          const { _id: achievementId, friendlyName, name: achievementName } = code.achievement;

          const functionName = achievementKeyToFunctionName[achievementName];
          const metadata = functionName ? achievementFunctionMetadata[functionName] : undefined;
          const isRepeatable = metadata ? metadata.repeatable : false;

          const uniqueSnapshotKey = `${reward._id.toString()}-${reward.friendlyName}-${reward.product}-${reward.discount ?? 'custom'}`;

          if (!rewardMap.has(uniqueSnapshotKey)) {
            rewardMap.set(uniqueSnapshotKey, {
              ...reward,
              repeatable: isRepeatable,
              achievementId: achievementId,
              achievementFriendlyName: friendlyName,
              codes: [],
            });
          }

          rewardMap.get(uniqueSnapshotKey)!.codes.push({
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
    setFilteringRewards(true);
    const mergeRewards = () => {
      const mergedMap = new Map<string, RewardWithAchievementContext>();

      // This establishes the baseline of what is currently earnable ("locked" state).
      for (const configuredItem of clientConfiguredRewards) {
        const reward = configuredItem.reward;
        if (!reward || !reward._id) continue;

        const uniqueSnapshotKey = `${reward._id.toString()}-${reward.friendlyName}-${reward.product}-${reward.discount ?? 'custom'}`;
        
        mergedMap.set(uniqueSnapshotKey, {
          ...reward,
          achievementId: configuredItem.achievementId,
          achievementFriendlyName: configuredItem.achievementFriendlyName,
          codes: [],
        });
      }

      // This will overwrite the locked versions with unlocked ones if they match,
      // and add any old, earned "snapshots" that no longer match a configured reward.
      for (const earned of allUserEarnedRewards) {
        const uniqueSnapshotKey = `${earned._id.toString()}-${earned.friendlyName}-${earned.product}-${earned.discount ?? 'custom'}`;
        mergedMap.set(uniqueSnapshotKey, earned);
      }
      
      // Convert the map to an array for filtering and sorting.
      const allRewardVersions = [...mergedMap.values()];

      const earnedAchievementIds = new Set(
        allRewardVersions
          .filter(reward => reward.codes && reward.codes.length > 0) // Find all earned rewards
          .map(reward => reward.achievementId) // Get their achievement IDs
      );

      const deduplicatedList = allRewardVersions.filter(reward => {
        // If the reward has NOT been earned yet, always keep it.
        if (!reward.codes || reward.codes.length === 0) {
          // BUT, if its corresponding achievement has ALREADY been earned by another
          // version of this reward, and it's non-repeatable, then HIDE it.
          if (earnedAchievementIds.has(reward.achievementId) && !reward.repeatable) {
            return false; // Hide this unearned, non-repeatable version
          }
          return true; // Keep this unearned, repeatable version
        }
        
        // If the reward HAS been earned, always keep it for now.
        // The final filter will handle its visibility based on redemption status.
        return true;
      });

      // Now we apply the rule to hide non-repeatable rewards that are fully redeemed.
      const visibleRewards = deduplicatedList.filter(reward => {
        if (!reward.codes || reward.codes.length === 0) {
          return true; // Keep all unearned rewards that passed the deduplication step
        }
        
        const areAllCodesRedeemed = reward.codes.every(c => c.redeemed);
        return reward.repeatable || !areAllCodesRedeemed;
      });

      // The sorting logic remains correct.
      const sortedList = visibleRewards.sort((a, b) => {
        const aUnlocked = a.codes.some(c => !c.redeemed);
        const bUnlocked = b.codes.some(c => !c.redeemed);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return (a.index ?? Infinity) - (b.index ?? Infinity);
      });

      setAllRewards(sortedList);
      setFilteringRewards(false);
    };
    
    mergeRewards();
    
  }, [clientConfiguredRewards, allUserEarnedRewards]);

  const displayedRewards = maxCount
    ? allRewards.slice(0, maxCount)
    : allRewards;

  if (fetchingRewards || filteringRewards) return (
    <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
        <Spinner size={'3'} style={{color: 'white'}} />
    </Flex>
  )

  if (displayedRewards.length === 0) {
    return (
      <Card>
        <Flex align="center" justify="center" p="4">
          <Text align={'center'} color="gray" size="3">
            You&apos;ve earned all available rewards! Check back later for new challenges.
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction={'column'} gap="4">
      {displayedRewards.map((reward) => {
        const uniqueSnapshotKey = `${reward._id.toString()}-${reward.friendlyName}-${reward.product}-${reward.discount ?? 'custom'}`;
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
            <Flex direction={'row'} gap={'3'} justify={'between'}>
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

                  {reward.product !== 'custom' && (
                    <Text size={'4'} color={isUnlocked ? undefined : 'gray'}
                      style={{ textTransform: 'uppercase' }}
                    >
                      {reward.product}
                    </Text>
                  )}
                  
                  {reward.productDescription && reward.product === 'pro shop' ? (
                    <Text size={'2'} color={isUnlocked ? undefined : 'gray'}>
                      {reward.productDescription}
                    </Text>
                  ) : (!reward.productDescription && reward.product === 'pro shop' ? (
                    <Text size={'2'} color={isUnlocked ? undefined : 'gray'}>
                    All products
                    </Text>
                  ) : null
                  )}
                  
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
          <Flex direction="column" key={uniqueSnapshotKey}>
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
        <Flex direction={'column'}>
          <RedeemRewardsDialog
            showRedeemRewardsDialog={true}
            setShowRedeemRewardsDialog={(open) => {
              if (!open) setSelectedReward(null)
            }}
            reward={selectedReward.reward}
            earnedInstance={selectedReward.instance}
            location={location}
          />
        </Flex>
      )}
    </Flex>
  )
}
