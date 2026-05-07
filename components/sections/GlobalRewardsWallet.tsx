'use client'

import { useEffect, useState } from 'react';
import { Flex, Box, Spinner, Text, Grid, Dialog, VisuallyHidden } from '@radix-ui/themes';
import { IDataSource } from '@/app/types/databaseTypes';
import { FrontendUser } from '@/app/types/frontendTypes';
import { achievementKeyToFunctionName } from '@/lib/achievements/definitions';
import { achievementFunctionMetadata } from '@/lib/achievements/achievementMetadata';
import { GlobalConfiguredReward, PopulatedGlobalRewardCode, RewardWithContext } from '@/app/types/rewardTypes';
import { RewardDetailView } from '../GlobalRewardsWallet/RewardDetailView';
import { ModernRewardCard } from '../GlobalRewardsWallet/ModernRewardCard';


type Props = {
  user: FrontendUser | null;
  dataSourceId: string;
};

export default function GlobalRewardsWallet({ user, dataSourceId }: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allRewards, setAllRewards] = useState<RewardWithContext[]>([]);
  const [dataSource, setDataSource] = useState<IDataSource | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null); 

  useEffect(() => {
    const fetchAllDataAndMerge = async () => {
      if (!dataSourceId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const dataSourcePromise = fetch(`/api/data-source`);
        let finalRewardsList: RewardWithContext[] = [];
        let fetchedDataSource: IDataSource | null = null;

        const getWinCount = (reward: any) => {
          const name = reward.achievementName || '';
          const match = name.match(/^(\d+)/);
          return match ? parseInt(match[1], 10) : Infinity;
        };

        if (!user) {
          // --- LOGIC FOR LOGGED-OUT USERS ---
          const rewardsPromise = fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
          const [dataSourceRes, rewardsRes] = await Promise.all([dataSourcePromise, rewardsPromise]);
          if (!dataSourceRes.ok || !rewardsRes.ok) throw new Error("Failed to fetch data for logged-out user");
          
          const dataSourceData = await dataSourceRes.json();

          const allDataSources = dataSourceData.dataSources || []; 
          fetchedDataSource = allDataSources.find((ds: IDataSource) => ds._id.toString() === dataSourceId) || null;

          const rewardsData = await rewardsRes.json();
          
          const configuredRewards = (rewardsData.rewards || []) as GlobalConfiguredReward[];
          const rewardsToDisplay = configuredRewards.map(item => ({
            ...item.reward,
            achievementId: item.achievement._id,
            achievementName: item.achievement.name,
            achievementFriendlyName: item.achievement.friendlyName,
            achievementTask: item.achievement.task,
            sponsoringClient: item.sponsoringClient,
            codes: [],
          }));
          
          finalRewardsList = rewardsToDisplay.sort((a, b) => getWinCount(a) - getWinCount(b));
        } else {
          // --- LOGIC FOR LOGGED-IN USERS ---
          const earnedPromise = fetch(`/api/reward-code/global-earned?userId=${user._id}&dataSourceId=${dataSourceId}`);
          const configuredPromise = fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
          const [dataSourceRes, earnedRes, configuredRes] = await Promise.all([dataSourcePromise, earnedPromise, configuredPromise]);

          if (!dataSourceRes.ok || !earnedRes.ok || !configuredRes.ok) throw new Error("Failed to fetch data for logged-in user.");
          
          const dataSourceData = await dataSourceRes.json();
          const allDataSources = dataSourceData.dataSources || [];
          fetchedDataSource = allDataSources.find((ds: IDataSource) => ds._id.toString() === dataSourceId) || null;

          const earnedData = await earnedRes.json();
          const configuredData = await configuredRes.json();
          const earnedCodes = (earnedData.codes || []) as PopulatedGlobalRewardCode[];
          const globalConfiguredRewards = (configuredData.rewards || []) as GlobalConfiguredReward[];
    
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

            const uniqueSnapshotKey = `${reward._id.toString()}-${code.clientId._id.toString()}`;

            if (!earnedRewardsMap.has(uniqueSnapshotKey)) {
              earnedRewardsMap.set(uniqueSnapshotKey, {
                ...reward,
                repeatable: isRepeatable,
                achievementId,
                achievementName,
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
  
          const mergedMap = new Map<string, RewardWithContext>();
  
          for (const configuredItem of globalConfiguredRewards) {
            const reward = configuredItem.reward;
            if (!reward || !reward._id) continue;
            const uniqueSnapshotKey = `${reward._id.toString()}-${configuredItem.sponsoringClient._id.toString()}`;
            mergedMap.set(uniqueSnapshotKey, {
              ...reward,
              achievementId: configuredItem.achievement._id,
              achievementName: configuredItem.achievement.name,
              achievementFriendlyName: configuredItem.achievement.friendlyName,
              achievementTask: configuredItem.achievement.task,
              sponsoringClient: configuredItem.sponsoringClient,
              codes: [],
            });
          }
          
          for (const earned of [...earnedRewardsMap.values()]) {
            const uniqueSnapshotKey = `${earned._id.toString()}-${earned.sponsoringClient._id.toString()}`;
            if (mergedMap.has(uniqueSnapshotKey)) {
              const existingEntry = mergedMap.get(uniqueSnapshotKey)!;
              existingEntry.codes = earned.codes;
              existingEntry.repeatable = earned.repeatable;
            } else {
              mergedMap.set(uniqueSnapshotKey, earned);
            }
          }
          
          const allRewardVersions = [...mergedMap.values()];

          /*
          const earnedAchievementIds = new Set(
            allRewardVersions.filter(r => r.codes.length > 0).map(r => r.achievementId)
          );

           const deduplicatedList = allRewardVersions.filter(reward => {
            if (reward.codes.length === 0) { 
              return !(earnedAchievementIds.has(reward.achievementId) && !reward.repeatable);
            }
            return true; 
          });
          */

          const earnedAchievementClientPairs = new Set(
            allRewardVersions
              .filter(r => r.codes.length > 0)
              .map(r => `${r.achievementId}-${r.sponsoringClient._id.toString()}`)
          );

          const deduplicatedList = allRewardVersions.filter(reward => {
            if (reward.codes.length === 0) { 
              // Only hide the locked version if THIS SPECIFIC CLIENT already 
              // gave you a code for this non-repeatable achievement.
              const pairKey = `${reward.achievementId}-${reward.sponsoringClient._id.toString()}`;
              return !(earnedAchievementClientPairs.has(pairKey) && !reward.repeatable);
            }
            return true; 
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
            return getWinCount(a) - getWinCount(b);
          });

          finalRewardsList = sortedList;
        }

        setDataSource(fetchedDataSource);
        setAllRewards(finalRewardsList);

      } catch (err) {
        console.error('Error fetching and merging global rewards:', err);
        setAllRewards([]);
        setDataSource(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDataAndMerge();
  }, [user, user?._id, dataSourceId]);

  if (isLoading) return <Flex justify="center" align="center" height="200px"><Spinner /></Flex>;
  
  if (!isLoading && allRewards.length === 0) {
    return <Flex justify="center" p="6"><Text color="gray">No rewards available yet.</Text></Flex>;
  }

  // --- UNIFIED GRID VIEW (Desktop & Mobile) ---
  return (
    <Box>
      <Grid columns={{ initial: '1', sm: '2', md: '3', lg: '3' }} gap="5">
        {allRewards.map((reward, index) => {
          const uniqueKey = `${reward._id.toString()}-${reward.sponsoringClient._id.toString()}`; 

          return (
            <ModernRewardCard
              key={uniqueKey}
              reward={reward}
              index={index}
              onClick={() => setActiveIndex(index)}
              dataSource={dataSource}
            />
          );
        })}
      </Grid>

      {/* Universal Detail Modal */}
      <Dialog.Root open={activeIndex !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <Dialog.Content maxWidth="450px" style={{padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'var(--slate-1)'}}>
          <VisuallyHidden><Dialog.Title>Redeem Reward</Dialog.Title></VisuallyHidden>
            {activeIndex !== null && (
              <Box style={{ position: 'relative' }}>
                <RewardDetailView
                  reward={allRewards[activeIndex]}
                  onClose={() => setActiveIndex(null)}
                  // Override absolute positioning to work nicely inside Dialog
                  style={{ position: 'relative', top: 0, left: 0, right: 0, margin: 0, opacity: 1, animation: 'none' }}
                />
              </Box>
            )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}