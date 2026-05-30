'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '@/app/contexts/UserContext';
import {
  Flex, Text, Heading, Button, Spinner,
  TextField, SegmentedControl, Card,
  Callout, Separator, Box, ScrollArea, Badge,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, InfoCircledIcon, MagicWandIcon,
  TrashIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@radix-ui/react-icons';
import {
  AdminPermissionType,
  IAchievement, IClient, IDataSource, IReward, ISourceRewardSponsorship,
} from '@/app/types/databaseTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { BrandPageShell } from '../../components/BrandPageShell';

// --- TYPES ---
type ClientSideSourceConfig = {
  dataSourceId: string;
  achievementName: string;
  sponsorships: ISourceRewardSponsorship[];
};

export default function BrandRewardConfigPage() {
  const { user } = useUserContext();
  const userId = user?.id;

  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [location, setLocation] = useState<IClient | null>(null);
  const [allAchievements, setAllAchievements] = useState<IAchievement[]>([]);
  const [allRewards, setAllRewards] = useState<IReward[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<IDataSource | null>(null);

  const [sourceConfigs, setSourceConfigs] = useState<ClientSideSourceConfig[]>([]);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);

  // UI State
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [searchQuery] = useState('');

  // Form State
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'dollars'>('percent');
  const [productDescription, setProductDescription] = useState('');
  const [minimumSpend, setMinimumSpend] = useState<number | null>(null);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(null);

  const [existingRewardId, setExistingRewardId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState(true);

  const isMobile = useIsMobile();

  // --- 0. GET ADMIN PERMISSIONS ---
  useEffect(() => {
    if (!userId) return;

    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          setAdminError("You don't have permission to access this page.");
          setIsGettingAdmin(false);
          return;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch admin data');

        if (data.admin.permission) setAdminPermission(data.admin.permission);
        setLocation(data.admin.location);
      } catch (err: unknown) {
        console.error('Error fetching admin data:', err);
        setAdminError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsGettingAdmin(false);
      }
    };

    getAdminUser();
  }, [userId]);

  // --- 1. FETCH GLOBAL CONTEXT DATA ---
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [achRes, dataSourceRes, rewardRes] = await Promise.all([
          fetch('/api/achievement/category/scope?scope=global'),
          fetch('/api/data-source'),
          fetch('/api/reward'),
        ]);

        const achievementsData = await achRes.json();
        const dataSourcesData = await dataSourceRes.json();
        const rewardsData = await rewardRes.json();

        setAllAchievements(achievementsData.achievements || []);
        setAllRewards(rewardsData.rewards || []);

        if (dataSourcesData.dataSources && dataSourcesData.dataSources.length > 0) {
          setSelectedDataSource(dataSourcesData.dataSources[0]);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [user]);

  // --- 2. FETCH CONFIGS ---
  useEffect(() => {
    if (!selectedDataSource?._id) return;

    const fetchConfigs = async () => {
      try {
        const res = await fetch(`/api/source-reward-config?dataSourceId=${selectedDataSource._id}`);
        const data = await res.json();

        if (res.ok) {
          const groupedConfigs: Record<string, ClientSideSourceConfig> = {};

          for (const reward of (data.rewards || [])) {
            const achName = reward.achievement.name;
            if (!groupedConfigs[achName]) {
              groupedConfigs[achName] = {
                dataSourceId: selectedDataSource._id.toString(),
                achievementName: achName,
                sponsorships: [],
              };
            }
            groupedConfigs[achName].sponsorships.push({
              sponsoringClientId: reward.sponsoringClient._id,
              rewardId: reward.reward._id,
            });
          }
          setSourceConfigs(Object.values(groupedConfigs));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchConfigs();
  }, [selectedDataSource?._id, isSaving, isRemoving]);

  // --- 3. POPULATE FORM ON SELECTION ---
  useEffect(() => {
    if (!selectedAchievement || !location) return;

    const config = sourceConfigs.find((c) => c.achievementName === selectedAchievement.name);
    const sponsorship = config?.sponsorships?.find(
      (s) => s.sponsoringClientId.toString() === location._id.toString()
    );

    if (sponsorship) {
      const reward = allRewards.find((r) => r._id.toString() === sponsorship.rewardId.toString());
      if (reward) {
        setExistingRewardId(reward._id.toString());
        setDiscountAmount(reward.discount || null);
        setDiscountType(reward.type === 'dollars' ? 'dollars' : 'percent');
        setProductDescription(reward.productDescription || '');
        setMinimumSpend(reward.minimumSpend || null);
        setMaxDiscount(reward.maxDiscount || null);
        return;
      }
    }

    setExistingRewardId(null);
    setDiscountAmount(null);
    setDiscountType('percent');
    setProductDescription('');
    setMinimumSpend(null);
    setMaxDiscount(null);
  }, [selectedAchievement, location, sourceConfigs, allRewards]);

  // --- SAVE HANDLER ---
  const handleSave = async () => {
    if (!selectedAchievement || !location || !selectedDataSource || !discountAmount) return;

    if (discountAmount <= 0) {
      setError('Discount amount must be greater than 0.');
      return;
    }
    if (discountType === 'percent' && discountAmount > 100) {
      setError('Percentage discount cannot exceed 100%.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const friendlyName = `${discountType === 'dollars' ? '$' : ''}${discountAmount}${discountType === 'percent' ? '%' : ''} off ${productDescription ? productDescription : 'Entire Order'}`;
      const rawSlug = `${discountAmount}-${discountType}-off-${productDescription || 'entire-order'}`;
      const name = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      const rewardPayload: Partial<IReward> = {
        friendlyName,
        name,
        type: discountType,
        category: 'retail',
        product: 'online store',
        productDescription: productDescription.trim() || undefined,
        discount: discountAmount,
        minimumSpend: minimumSpend ?? undefined,
        maxDiscount: maxDiscount ?? undefined,
      };

      let finalRewardObj: IReward;

      if (existingRewardId) {
        const updateRes = await fetch('/api/reward', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rewardPayload, id: existingRewardId }),
        });

        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update reward.');
        finalRewardObj = updateData.reward;
      } else {
        const createRes = await fetch('/api/reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rewardPayload),
        });

        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create reward.');
        finalRewardObj = createData.reward;

        const configPayload = {
          dataSourceId: selectedDataSource._id,
          achievementName: selectedAchievement.name,
          sponsorship: {
            sponsoringClientId: location._id,
            rewardId: finalRewardObj._id,
          },
        };

        const configRes = await fetch('/api/source-reward-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload),
        });

        if (!configRes.ok) throw new Error('Failed to link reward.');
      }

      const finalRewardId = finalRewardObj._id;

      setAllRewards((prev) => {
        const exists = prev.findIndex((r) => r._id === finalRewardId);
        if (exists > -1) {
          const next = [...prev];
          next[exists] = finalRewardObj;
          return next;
        }
        return [...prev, finalRewardObj];
      });

      setSourceConfigs((prev) => {
        const next = [...prev];
        const configIndex = next.findIndex((c) => c.achievementName === selectedAchievement?.name);
        const newSponsorship = { sponsoringClientId: location._id, rewardId: finalRewardId };

        if (configIndex > -1) {
          const existingSponsorshipIndex = next[configIndex].sponsorships.findIndex(
            (s) => s.sponsoringClientId.toString() === location._id.toString()
          );
          if (existingSponsorshipIndex > -1) {
            next[configIndex].sponsorships[existingSponsorshipIndex] = newSponsorship;
          } else {
            next[configIndex].sponsorships.push(newSponsorship);
          }
        } else {
          next.push({
            dataSourceId: selectedDataSource._id.toString(),
            achievementName: selectedAchievement!.name,
            sponsorships: [newSponsorship],
          });
        }
        return next;
      });

      setExistingRewardId(finalRewardId.toString());
      setSuccessMsg(existingRewardId ? 'Reward updated successfully.' : 'Reward created successfully.');

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- REMOVE HANDLER ---
  const handleRemove = async () => {
    if (!existingRewardId || !selectedAchievement || !selectedDataSource || !location) return;
    setIsRemoving(true);

    try {
      const res = await fetch('/api/source-reward-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: selectedDataSource._id,
          achievementName: selectedAchievement.name,
          rewardId: existingRewardId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to remove sponsorship');
      }

      setSourceConfigs((prev) => {
        const next = [...prev];
        const configIndex = next.findIndex((c) => c.achievementName === selectedAchievement.name);
        if (configIndex > -1) {
          next[configIndex].sponsorships = next[configIndex].sponsorships.filter(
            (s) => s.rewardId.toString() !== existingRewardId
          );
        }
        return next;
      });

      setSuccessMsg('Reward removed.');
      setExistingRewardId(null);
      setDiscountAmount(null);
      setProductDescription('');

      if (isMobile) {
        setTimeout(() => setSelectedAchievement(null), 1500);
      }

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove reward');
    } finally {
      setIsRemoving(false);
    }
  };

  useEffect(() => {
    setSuccessMsg(null);
    setError(null);
  }, [selectedAchievement]);

  const filteredAchievements = useMemo(() => {
    return allAchievements.filter((a) =>
      a.friendlyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allAchievements, searchQuery]);

  const isSaveDisabled = !discountAmount;

  // --- MOBILE LAYOUT LOGIC ---
  const showSidebarList = !isMobile || (isMobile && !selectedAchievement);
  const showDetailCanvas = !isMobile || (isMobile && !!selectedAchievement);

  if (isMobile === null || isLoading || isGettingAdmin) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (adminError) {
    return (
      <Flex direction="column" height="100vh" align="center" justify="center" gap="4">
        <Text color="red" size="4">{adminError}</Text>
        <Button onClick={() => (window.location.href = '/')}>Go Home</Button>
      </Flex>
    );
  }

  if (!location) {
    return (
      <BrandPageShell adminPermission={adminPermission} location={null}>
        <Flex direction="column" align="center" justify="center" flexGrow="1">
          <Heading mb="2">Access Denied</Heading>
          <Text color="gray">
            You do not have a client configuration associated with your account.
          </Text>
        </Flex>
      </BrandPageShell>
    );
  }

  if (user && adminPermission !== 'admin') {
    return (
      <BrandPageShell adminPermission={adminPermission} location={location}>
        <Flex direction="column" align="center" justify="center" height="300px">
          <Text>You do not have access to this page</Text>
        </Flex>
      </BrandPageShell>
    );
  }

  return (
    <BrandPageShell
      adminPermission={adminPermission}
      location={location}
      contentMaxWidth="none"
      contentPadding="0"
    >
      <Flex style={{ height: '100%' }}>
        {/* --- LEFT: ACHIEVEMENTS LIST (Master View) --- */}
        {showSidebarList && (
          <Flex
            direction="column"
            width={{ initial: '100%', md: '320px' }}
            style={{
              backgroundColor: 'white',
              borderRight: isMobile ? 'none' : '1px solid var(--gray-4)',
              flexShrink: 0,
            }}
          >
            <Box px="4" py="4" style={{ borderBottom: '1px solid var(--gray-4)' }}>
              <Heading size="4">Configure Rewards</Heading>
              <Text size="2" color="gray">
                Select an achievement to configure its reward.
              </Text>
            </Box>

            <ScrollArea type="hover" scrollbars="vertical">
              <Flex direction="column" p="2">
                {filteredAchievements.map((ach) => {
                  const configForAch = sourceConfigs.find((c) => c.achievementName === ach.name);
                  const isSponsored = configForAch?.sponsorships?.some(
                    (s) => s.sponsoringClientId.toString() === location?._id.toString()
                  );
                  const isSelected = selectedAchievement?._id === ach._id;

                  return (
                    <Button
                      key={ach._id.toString()}
                      variant="ghost"
                      color="gray"
                      onClick={() => setSelectedAchievement(ach)}
                      style={{
                        justifyContent: 'space-between',
                        height: 'auto',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        backgroundColor: isSelected && !isMobile ? 'var(--accent-3)' : 'transparent',
                        color: isSelected && !isMobile ? 'var(--accent-11)' : 'var(--gray-12)',
                        marginBottom: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Flex align="center" gap="3">
                        <Box
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: isSponsored ? 'var(--green-9)' : 'var(--gray-5)',
                            flexShrink: 0,
                          }}
                        />
                        <Flex direction="column" align="start">
                          <Text weight={isSelected && !isMobile ? 'bold' : 'medium'} size="2">
                            {ach.friendlyName}
                          </Text>
                          <Text size="1" color={isSelected && !isMobile ? undefined : 'gray'}>
                            {ach.name.length > 30 ? ach.name.substring(0, 30) + '...' : ach.name}
                          </Text>
                        </Flex>
                      </Flex>

                      <Flex align="center" gap="2">
                        {isSponsored && !isMobile && <CheckCircledIcon color="green" />}
                        {isMobile && <ChevronRightIcon color="gray" />}
                      </Flex>
                    </Button>
                  );
                })}
              </Flex>
            </ScrollArea>
          </Flex>
        )}

        {/* --- RIGHT: DETAIL CANVAS --- */}
        {showDetailCanvas && (
          <Flex
            flexGrow="1"
            justify="center"
            style={{ overflowY: 'auto', position: 'relative' }}
            p={{ initial: '4', md: '6' }}
          >
            {selectedAchievement ? (
              <Flex direction="column" maxWidth="800px" width="100%" gap="6">
                {isMobile && (
                  <Button
                    variant="ghost"
                    color="gray"
                    onClick={() => setSelectedAchievement(null)}
                    style={{ alignSelf: 'flex-start', padding: 0 }}
                  >
                    <ChevronLeftIcon width="20" height="20" /> Back to Achievements
                  </Button>
                )}

                <Flex
                  justify="between"
                  align="center"
                  direction={{ initial: 'column', xs: 'row' }}
                  gap="2"
                  style={{ alignItems: isMobile ? 'flex-start' : 'center' }}
                >
                  <Box>
                    <Heading size="6" mb="1" style={{ color: 'var(--slate-12)' }}>
                      {selectedAchievement.friendlyName}
                    </Heading>
                    <Text size="2" color="gray">
                      Configure the reward players receive when earning this achievement.
                    </Text>
                  </Box>
                  {existingRewardId && (
                    <Badge color="green" size="2">
                      <CheckCircledIcon /> Active
                    </Badge>
                  )}
                </Flex>

                <Separator size="4" />

                <Flex
                  gap="6"
                  align="start"
                  direction={{ initial: 'column', lg: 'row' }}
                  width={{ initial: '100%', md: '70%' }}
                >
                  <Flex direction="column" gap="5" flexGrow="1">
                    <Card size="3" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '16px' }}>
                      <Flex direction="column" gap="5">
                        <Flex direction="column" gap="3">
                          <Text size="2" weight="bold" color="gray" style={{ letterSpacing: '0.05em' }}>
                            REWARD DETAILS
                          </Text>
                          {(successMsg || error) && (
                            <Callout.Root color={error ? 'red' : 'green'} size="1">
                              <Callout.Icon>
                                {error ? <InfoCircledIcon /> : <CheckCircledIcon />}
                              </Callout.Icon>
                              <Callout.Text>{error || successMsg}</Callout.Text>
                            </Callout.Root>
                          )}
                        </Flex>

                        <Flex direction="column" gap="4">
                          <Flex gap="4">
                            <Box flexGrow="1">
                              <Text size="2" weight="bold" mb="1" as="div">Amount</Text>
                              <TextField.Root
                                size="3"
                                type="number"
                                placeholder="0"
                                value={discountAmount ?? ''}
                                onChange={(e) => setDiscountAmount(Number(e.target.value) || null)}
                              />
                            </Box>
                            <Box width="120px">
                              <Text size="2" weight="bold" mb="1" as="div">Type</Text>
                              <SegmentedControl.Root
                                size="3"
                                value={discountType}
                                onValueChange={(v) => setDiscountType(v as 'percent' | 'dollars')}
                              >
                                <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
                                <SegmentedControl.Item value="dollars">$</SegmentedControl.Item>
                              </SegmentedControl.Root>
                            </Box>
                          </Flex>

                          <Flex gap="4">
                            {discountType === 'dollars' && (
                              <Box flexGrow="1">
                                <Text size="2" weight="bold" mb="1" as="div">Min Spend</Text>
                                <TextField.Root
                                  size="3"
                                  type="number"
                                  value={minimumSpend ?? ''}
                                  onChange={(e) => setMinimumSpend(Number(e.target.value) || null)}
                                >
                                  <TextField.Slot>$</TextField.Slot>
                                </TextField.Root>
                              </Box>
                            )}
                          </Flex>
                        </Flex>

                        <Separator size="4" />

                        <Flex justify="between" align="center" wrap="wrap" gap="3">
                          {existingRewardId ? (
                            <Button variant="ghost" color="red" onClick={handleRemove} disabled={isRemoving}>
                              <TrashIcon /> Remove Reward
                            </Button>
                          ) : (
                            <Box />
                          )}

                          <Flex gap="3">
                            <Button
                              size="3"
                              onClick={handleSave}
                              loading={isSaving}
                              disabled={isSaveDisabled}
                              style={{ backgroundColor: 'var(--slate-12)', color: 'white' }}
                            >
                              {existingRewardId ? 'Save Changes' : 'Create Reward'}
                            </Button>
                          </Flex>
                        </Flex>
                      </Flex>
                    </Card>
                  </Flex>
                </Flex>
              </Flex>
            ) : (
              <Flex
                direction="column"
                align="center"
                justify="center"
                height="100%"
                style={{ opacity: 0.4 }}
              >
                <MagicWandIcon width="64" height="64" />
                <Heading size="6" mt="4">Select an Achievement</Heading>
                <Text>Choose an item from the sidebar to configure rewards.</Text>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </BrandPageShell>
  );
}