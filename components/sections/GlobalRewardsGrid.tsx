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

// --- TYPE DEFINITIONS ADAPTED FOR GLOBAL REWARDS ---

// Represents a fully populated reward from the global config, as returned by the new API
type GlobalConfiguredReward = {
  achievement: {
    _id: string;
    name: string;
    friendlyName: string;
    task: string
  };
  reward: IRewardWithCode;
  sponsoringClient: IClient;
};

// The main data structure for displaying a reward in the grid
type RewardWithContext = IRewardWithCode & {
  achievementId: string;
  achievementFriendlyName: string;
  achievementTask: string;
  sponsoringClient: IClient;
  codes: {
    _id: string;
    code: string;
    redeemed: boolean;
    earnedAt: Date;
    redemptionDate?: Date;
  }[];
};

// Represents an earned global reward code, with populated achievement data
type PopulatedGlobalRewardCode = Omit<IRewardCode, 'rewardId' | 'achievementId'> & {
  // The API populates achievementId into an object
  achievementId: { _id: string; friendlyName: string; task: string, name: string };
  // The API populates clientId into a full IClient object
  clientId: IClient; 
};

type Props = {
  user: FrontendUser | null;
  dataSourceId: string;
  variant?: 'preview' | 'full';
  maxCount?: number;
};

export default function GlobalRewardsGrid({ user, dataSourceId, maxCount }: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allRewards, setAllRewards] = useState<RewardWithContext[]>([]);
  const [selectedReward, setSelectedReward] = useState<{
    reward: RewardWithContext;
    instance: { redeemed: boolean; earnedAt: Date; _id: string };
  } | null>(null);

  useEffect(() => {
    const fetchAllDataAndMerge = async () => {
      if (!dataSourceId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (!user) {
          // --- LOGIC FOR LOGGED-OUT USERS (VIEWING ALL GLOBAL REWARDS) ---
          const res = await fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
          if (!res.ok) throw new Error("Failed to fetch global configured rewards");
          
          const data = await res.json();
          // The API should transform the GGRConfig Map into a flat array
          const configuredRewards = (data.rewards || []) as GlobalConfiguredReward[];

          // Convert configured rewards to the display format (all are "locked")
          const rewardsToDisplay = configuredRewards.map(item => ({
            ...item.reward,
            achievementId: item.achievement._id,
            achievementFriendlyName: item.achievement.friendlyName,
            achievementTask: item.achievement.task,
            sponsoringClient: item.sponsoringClient,
            codes: [],
          }));
          
          setAllRewards(rewardsToDisplay.sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity)));
          return;
        }

        // --- LOGIC FOR LOGGED-IN USERS ---
        const [earnedRes, configuredRes] = await Promise.all([
          // This API call now fetches only global rewards for the user
          fetch(`/api/reward-code/global-earned?userId=${user._id}&dataSourceId=${dataSourceId}`),
          // This API fetches all available global rewards
          fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`)
        ]);

        if (!earnedRes.ok || !configuredRes.ok) {
          console.error("Failed to fetch one or more reward sources.");
          return;
        }

        const earnedData = await earnedRes.json();
        const configuredData = await configuredRes.json();
        
        const earnedCodes = (earnedData.codes || []) as PopulatedGlobalRewardCode[];
        const globalConfiguredRewards = (configuredData.rewards || []) as GlobalConfiguredReward[];

        // --- PROCESS EARNED REWARDS (INJECT `repeatable` FLAG) ---
        const earnedRewardsMap = new Map<string, RewardWithContext>();
        const configuredRewardIds = new Set(globalConfiguredRewards.map(item => item.reward._id.toString()));

        for (const code of earnedCodes) {
          const reward = code.reward;
          const { _id: achievementId, friendlyName, name: achievementName, task } = code.achievementId;
          const functionName = achievementKeyToFunctionName[achievementName];
          const metadata = functionName ? achievementFunctionMetadata[functionName] : undefined;

          const isStillConfigured = configuredRewardIds.has(reward._id.toString());
          const isFunctionRepeatable = metadata ? metadata.repeatable : false;
          const isRepeatable = isFunctionRepeatable && isStillConfigured;

          // The unique key now includes the sponsoring client ID to differentiate rewards
          const uniqueSnapshotKey = `${reward._id.toString()}-${code.clientId._id.toString()}`;

          if (!earnedRewardsMap.has(uniqueSnapshotKey)) {
            earnedRewardsMap.set(uniqueSnapshotKey, {
              ...reward,
              repeatable: isRepeatable,
              achievementId,
              achievementFriendlyName: friendlyName,
              achievementTask: task,
              sponsoringClient: code.clientId, 
              codes: [],
            });
          }
          earnedRewardsMap.get(uniqueSnapshotKey)!.codes.push({
             _id: code._id.toString(),
             code: code.code,
             redeemed: code.redeemed,
             redemptionDate: code.redemptionDate,
             earnedAt: code.createdAt,
          });
        }

        // --- MERGE AND FILTER LOGIC ---
        const mergedMap = new Map<string, RewardWithContext>();

        // First, add all possible rewards from the global configuration
        for (const configuredItem of globalConfiguredRewards) {
          const reward = configuredItem.reward;
          if (!reward || !reward._id) continue;
          const uniqueSnapshotKey = `${reward._id.toString()}-${configuredItem.sponsoringClient._id.toString()}`;
          mergedMap.set(uniqueSnapshotKey, {
            ...reward,
            achievementId: configuredItem.achievement._id,
            achievementFriendlyName: configuredItem.achievement.friendlyName,
            achievementTask: configuredItem.achievement.task,
            sponsoringClient: configuredItem.sponsoringClient,
            codes: [],
          });
        }
        
        // Then, overwrite with any earned rewards to include the user's codes
        for (const earned of [...earnedRewardsMap.values()]) {
          const uniqueSnapshotKey = `${earned._id.toString()}-${earned.sponsoringClient._id.toString()}`;
          mergedMap.set(uniqueSnapshotKey, earned);
        }
        
        // The rest of the filtering and sorting logic is identical to the original component
        const allRewardVersions = [...mergedMap.values()];

        const earnedAchievementIds = new Set(
          allRewardVersions.filter(r => r.codes.length > 0).map(r => r.achievementId)
        );

        const deduplicatedList = allRewardVersions.filter(reward => {
          if (reward.codes.length === 0) { // is a locked reward
            return !(earnedAchievementIds.has(reward.achievementId) && !reward.repeatable);
          }
          return true; // is an earned reward
        });

        const visibleRewards = deduplicatedList.filter(reward => {
          if (reward.codes.length === 0) return true;
          const areAllCodesRedeemed = reward.codes.every(c => c.redeemed);
          return reward.repeatable || !areAllCodesRedeemed;
        });

        const sortedList = visibleRewards.sort((a, b) => {
          const aUnlocked = a.codes.some(c => !c.redeemed);
          const bUnlocked = b.codes.some(c => !c.redeemed);
          if (aUnlocked && !bUnlocked) return -1;
          if (!aUnlocked && bUnlocked) return 1;
          return (a.index ?? Infinity) - (b.index ?? Infinity);
        });

        setAllRewards(sortedList);

      } catch (err) {
        console.error('Error fetching and merging global rewards:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDataAndMerge();
  }, [user, user?._id, dataSourceId]);

  const displayedRewards = maxCount ? allRewards.slice(0, maxCount) : allRewards;

  if (isLoading) return (
      <Flex direction={'row'} width={'100%'} align={'center'} justify={'center'}>
          <Spinner size={'3'} style={{color: 'white'}} />
      </Flex>
  )

  return (
    <Flex direction={'column'} gap="4">
      {displayedRewards.map((reward) => {
        // The unique key for mapping must now include the client ID
        const uniqueKey = `${reward._id.toString()}-${reward.sponsoringClient._id.toString()}`;
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
            <Flex direction={'column'} gap={'3'} justify={'between'}>
              <Flex direction={'column'} gap={'3'} align={'center'} justify={'center'}>
                <Box position={'relative'}>
                  <Image
                    src={reward.sponsoringClient.logo}
                    alt={`${reward.sponsoringClient.name} logo`}
                    height={200}
                    width={200}
                    style={{maxWidth: '100px', height: 'auto'}}
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
                <Flex direction={'column'} justify={'center'} align={'center'}>
                  <Text align={'center'} wrap={'pretty'}>To unlock: {reward.achievementTask}.</Text>
                </Flex>
              )}
            </Flex>
          </Card>
        )

        return (
          <Flex direction="column" key={uniqueKey}>
            {isUnlocked ? (
              <div
                onClick={() => {
                  const earnedInstances = (reward.codes ?? [])
                    .filter(c => !c.redeemed)
                    .sort((a, b) => new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime());

                  if (earnedInstances.length > 0) {
                    setSelectedReward({
                      reward,
                      instance: earnedInstances[0]
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
            setShowRedeemRewardsDialog={(open) => { if (!open) setSelectedReward(null) }}
            reward={selectedReward.reward}
            earnedInstance={selectedReward.instance}
            // DYNAMIC LOCATION: Pass the specific sponsoring client to the dialog
            location={selectedReward.reward.sponsoringClient as IClient}
          />
        </Flex>
      )}
    </Flex>
  )
}