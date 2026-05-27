'use client'

import { useEffect, useState } from 'react';
import { Flex, Box, Spinner, Text, Grid, Dialog, VisuallyHidden, Button } from '@radix-ui/themes';
import { ReloadIcon } from '@radix-ui/react-icons';
import { IDataSource } from '@/app/types/databaseTypes';
import { FrontendUser } from '@/app/types/frontendTypes';
import { achievementKeyToFunctionName } from '@/lib/achievements/definitions';
import { achievementFunctionMetadata } from '@/lib/achievements/achievementMetadata';
import { GlobalConfiguredReward, PopulatedGlobalRewardCode, RewardWithContext } from '@/app/types/rewardTypes';
import { RewardDetailView } from '../GlobalRewardsWallet/RewardDetailView';
import { ModernRewardCard } from '../GlobalRewardsWallet/ModernRewardCard';

type WalletStatus = 'loading' | 'error' | 'empty' | 'ready';

type Props = {
  user: FrontendUser | null;
  dataSourceId: string;
};

export default function GlobalRewardsWallet({ user, dataSourceId }: Props) {
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [allRewards, setAllRewards] = useState<RewardWithContext[]>([]);
  const [dataSource, setDataSource] = useState<IDataSource | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fetchAllDataAndMerge = async () => {
    if (!dataSourceId) {
      setStatus('empty');
      return;
    }

    setStatus('loading');

    try {
      const dataSourcePromise = fetch('/api/data-source');
      let finalRewardsList: RewardWithContext[] = [];
      let fetchedDataSource: IDataSource | null = null;

      const getWinCount = (reward: any) => {
        const name = reward.achievementName || '';
        const match = name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
      };

      if (!user) {
        // ── Logged-out ──────────────────────────────────────────────────────
        const rewardsPromise = fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
        const [dataSourceRes, rewardsRes] = await Promise.all([dataSourcePromise, rewardsPromise]);

        if (!dataSourceRes.ok || !rewardsRes.ok) {
          throw new Error(`Fetch failed — datasource: ${dataSourceRes.status}, rewards: ${rewardsRes.status}`);
        }

        const dataSourceData = await dataSourceRes.json();
        const allDataSources = dataSourceData.dataSources || [];
        fetchedDataSource = allDataSources.find((ds: IDataSource) => ds._id.toString() === dataSourceId) || null;

        const rewardsData = await rewardsRes.json();
        const configuredRewards = (rewardsData.rewards || []) as GlobalConfiguredReward[];

        finalRewardsList = configuredRewards.map(item => ({
          ...item.reward,
          achievementId: item.achievement._id,
          achievementName: item.achievement.name,
          achievementFriendlyName: item.achievement.friendlyName,
          achievementTask: item.achievement.task,
          sponsoringClient: item.sponsoringClient,
          codes: [],
        })).sort((a, b) => getWinCount(a) - getWinCount(b));

      } else {
        // ── Logged-in ───────────────────────────────────────────────────────
        const earnedPromise = fetch(`/api/reward-code/global-earned?userId=${user._id}&dataSourceId=${dataSourceId}`);
        const configuredPromise = fetch(`/api/source-reward-config?dataSourceId=${dataSourceId}`);
        const [dataSourceRes, earnedRes, configuredRes] = await Promise.all([
          dataSourcePromise, earnedPromise, configuredPromise,
        ]);

        if (!dataSourceRes.ok || !earnedRes.ok || !configuredRes.ok) {
          throw new Error(
            `Fetch failed — datasource: ${dataSourceRes.status}, earned: ${earnedRes.status}, configured: ${configuredRes.status}`
          );
        }

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

        const earnedAchievementClientPairs = new Set(
          allRewardVersions
            .filter(r => r.codes.length > 0)
            .map(r => `${r.achievementId}-${r.sponsoringClient._id.toString()}`)
        );

        const deduplicatedList = allRewardVersions.filter(reward => {
          if (reward.codes.length === 0) {
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

        finalRewardsList = visibleRewards.sort((a, b) => {
          const aUnlocked = a.codes.some(c => !c.redeemed);
          const bUnlocked = b.codes.some(c => !c.redeemed);
          if (aUnlocked && !bUnlocked) return -1;
          if (!aUnlocked && bUnlocked) return 1;
          return getWinCount(a) - getWinCount(b);
        });
      }

      setDataSource(fetchedDataSource);
      setAllRewards(finalRewardsList);
      setStatus(finalRewardsList.length === 0 ? 'empty' : 'ready');

    } catch (err) {
      console.error('[GlobalRewardsWallet] Fetch error:', err);
      setStatus('error');
    }
  };

  useEffect(() => { fetchAllDataAndMerge(); }, [user, user?._id, dataSourceId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Flex justify="center" align="center" height="200px">
        <Spinner style={{ color: '#a3e635' }} />
      </Flex>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <Flex
        direction="column"
        align="center"
        gap="4"
        p="8"
        style={{
          background: 'rgba(239,68,68,0.05)',
          border: '0.5px solid rgba(239,68,68,0.15)',
          borderRadius: 16,
        }}
      >
        <Text size="3" weight="bold" style={{ color: '#f87171' }}>
          Couldn't load rewards
        </Text>
        <Text size="2" align="center" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 320 }}>
          Something went wrong fetching your rewards. This is usually temporary.
        </Text>
        <Button
          size="2"
          radius="full"
          onClick={fetchAllDataAndMerge}
          style={{
            backgroundColor: 'rgba(163,230,53,0.15)',
            color: '#a3e635',
            border: '0.5px solid rgba(163,230,53,0.25)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <ReloadIcon style={{ marginRight: 6 }} />
          Try Again
        </Button>
      </Flex>
    );
  }

  // ── Empty — no brands participating yet ────────────────────────────────────
  if (status === 'empty') {
    return (
      <Flex
        direction="column"
        align="center"
        gap="3"
        p="8"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
        }}
      >
        <Text size="3" weight="bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          No rewards available yet
        </Text>
        <Text size="2" align="center" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 320 }}>
          Brand partners are being added regularly. Sync your matches and check back soon — rewards unlock automatically as you hit win milestones.
        </Text>
      </Flex>
    );
  }

  // ── Ready ──────────────────────────────────────────────────────────────────
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

      <Dialog.Root
        open={activeIndex !== null}
        onOpenChange={(open) => !open && setActiveIndex(null)}
      >
        <Dialog.Content
          maxWidth="450px"
          style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'var(--slate-1)' }}
        >
          <VisuallyHidden><Dialog.Title>Redeem Reward</Dialog.Title></VisuallyHidden>
          {activeIndex !== null && (
            <Box style={{ position: 'relative' }}>
              <RewardDetailView
                reward={allRewards[activeIndex]}
                onClose={() => setActiveIndex(null)}
                style={{ position: 'relative', top: 0, left: 0, right: 0, margin: 0, opacity: 1, animation: 'none' }}
              />
            </Box>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}