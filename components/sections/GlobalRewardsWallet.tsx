'use client'

import { useEffect, useState } from 'react';
import { Flex, Box, Spinner, Text, Grid, Dialog, VisuallyHidden } from '@radix-ui/themes';
import { IDataSource } from '@/app/types/databaseTypes';
import { FrontendUser } from '@/app/types/frontendTypes';
import { achievementKeyToFunctionName } from '@/lib/achievements/definitions';
import { achievementFunctionMetadata } from '@/lib/achievements/achievementMetadata';
import { GlobalConfiguredReward, PopulatedGlobalRewardCode, RewardWithContext } from '@/app/types/rewardTypes';
import { RewardCard } from '../GlobalRewardsWallet/RewardCard';
import { RewardDetailView } from '../GlobalRewardsWallet/RewardDetailView';
import { useIsMobile } from "@/app/hooks/useIsMobile";

import '../GlobalRewardsWallet/wallet.css'; 

type Props = {
  user: FrontendUser | null;
  dataSourceId: string;
};

export default function GlobalRewardsWallet({ user, dataSourceId }: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allRewards, setAllRewards] = useState<RewardWithContext[]>([]);
  const [dataSource, setDataSource] = useState<IDataSource | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null); 
  
  const isMobile = useIsMobile();

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

        if (!user) {
          // --- LOGIC FOR LOGGED-OUT USERS ---
          const rewardsPromise = fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
          const [dataSourceRes, rewardsRes] = await Promise.all([dataSourcePromise, rewardsPromise]);
          if (!dataSourceRes.ok || !rewardsRes.ok) throw new Error("Failed to fetch data for logged-out user");
          
          const dataSourceData = await dataSourceRes.json();

          const allDataSources = dataSourceData.dataSources || []; 
          fetchedDataSource = allDataSources.find((ds: IDataSource) => ds._id.toString() === dataSourceId) || null;

          const rewardsData = await rewardsRes.json();
          console.log('rewardsData:', rewardsData)
          
          const configuredRewards = (rewardsData.rewards || []) as GlobalConfiguredReward[];
          const rewardsToDisplay = configuredRewards.map(item => ({
            ...item.reward,
            achievementId: item.achievement._id,
            achievementFriendlyName: item.achievement.friendlyName,
            achievementTask: item.achievement.task,
            sponsoringClient: item.sponsoringClient,
            codes: [],
          }));
          
          finalRewardsList = rewardsToDisplay.sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
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

        const earnedAchievementIds = new Set(
          allRewardVersions.filter(r => r.codes.length > 0).map(r => r.achievementId)
        );

        const deduplicatedList = allRewardVersions.filter(reward => {
          if (reward.codes.length === 0) { 
            return !(earnedAchievementIds.has(reward.achievementId) && !reward.repeatable);
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
            return (a.index ?? Infinity) - (b.index ?? Infinity);
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

  // --- INTERACTION HANDLERS ---
  const handleCardClick = (index: number) => {
    if (index === activeIndex) {
      setActiveIndex(null);
    } else {
      setActiveIndex(index);
    }
  };

  if (isLoading) return <Flex justify="center" align="center" height="200px"><Spinner /></Flex>;
  
  if (!isLoading && allRewards.length === 0) {
    return <Flex justify="center" p="6"><Text>You haven&apos;t earned any rewards yet.</Text></Flex>;
  }

  // --- DESKTOP VIEW (Grid + Modal) ---
  if (isMobile === false) {
    return (
      <Box className="wallet-grid">
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="5">
          {allRewards.map((reward, index) => {
            const unredeemedCount = reward.codes?.filter(c => !c.redeemed).length ?? 0;
            const isUnlocked = unredeemedCount > 0;
            const uniqueKey = `${reward._id.toString()}-${reward.sponsoringClient._id.toString()}`; 

            return (
              <Box key={uniqueKey} style={{ position: 'relative', height: '240px' }}>
                <RewardCard
                  reward={reward}
                  index={index}
                  zIndex={1}
                  isActiveCard={false} // Always false in grid mode, we use Dialog for details
                  isUnlocked={isUnlocked}
                  onClick={() => setActiveIndex(index)}
                  backgroundImage={reward.sponsoringClient.cardBackgroundImage}
                  textColor={reward.sponsoringClient.cardTextColor}
                  dataSource={dataSource}
                />
              </Box>
            );
          })}
        </Grid>

        {/* Desktop Detail Modal */}
        <Dialog.Root open={activeIndex !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
          <Dialog.Content maxWidth="450px" style={{padding: 0, borderRadius: '16px', overflow: 'hidden'}}>
            <VisuallyHidden><Dialog.Title>Redeem Reward</Dialog.Title></VisuallyHidden>
             {/* Render Detail View inside Modal without absolute positioning */}
             {activeIndex !== null && (
               <Box style={{ position: 'relative' }}>
                 <RewardDetailView
                    reward={allRewards[activeIndex]}
                    onClose={() => setActiveIndex(null)}
                    // Override the absolute positioning styles for modal context
                    style={{ position: 'relative', top: 0, left: 0, right: 0, margin: 0, opacity: 1, animation: 'none' }}
                 />
               </Box>
             )}
          </Dialog.Content>
        </Dialog.Root>
      </Box>
    )
  }

  // --- MOBILE VIEW (Stacked Wallet) ---
  return (
    <Box 
      className={`wallet-container ${activeIndex !== null ? 'is-expanded' : ''}`}
      style={{ '--num-cards': allRewards.length } as React.CSSProperties}
    >
      <Box 
        className={`wallet-stack ${activeIndex !== null ? 'is-active' : ''}`}
      >
        <Box className="wallet-spacer" />
        {allRewards.map((reward, index) => {
          const unredeemedCount = reward.codes?.filter(c => !c.redeemed).length ?? 0;
          const isUnlocked = unredeemedCount > 0;
          const uniqueKey = `${reward._id.toString()}-${reward.sponsoringClient._id.toString()}`;         
          
          return (
            <RewardCard
              key={uniqueKey}
              reward={reward}
              index={index}
              zIndex={index}
              isActiveCard={activeIndex === index} 
              isUnlocked={isUnlocked}
              onClick={() => handleCardClick(index)}
              backgroundImage={reward.sponsoringClient.cardBackgroundImage}
              textColor={reward.sponsoringClient.cardTextColor}
              dataSource={dataSource}
            />
          );
        })}
      </Box>
      
      {/* Detail View that slides in */}
      {activeIndex !== null && (
        <RewardDetailView
          reward={allRewards[activeIndex]}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </Box>
  );
}