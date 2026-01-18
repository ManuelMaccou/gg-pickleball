'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { 
  Flex, Heading, Select, Button, Spinner, Text, Badge, TextField, SegmentedControl, AlertDialog, 
  Card, Separator, Box, ScrollArea, Avatar, Callout, IconButton 
} from '@radix-ui/themes';
import { 
  CheckCircledIcon, InfoCircledIcon, MagnifyingGlassIcon, MagicWandIcon, TrashIcon, Pencil1Icon, Cross2Icon 
} from "@radix-ui/react-icons";
import { 
  AdminPermissionType, IAchievement, IClient, IDataSource, IReward, ISourceRewardSponsorship, RewardProductName 
} from '@/app/types/databaseTypes';
import { toTitleCase } from '@/utils/formatters';
import { useUserContext } from '@/app/contexts/UserContext';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminSidebar } from '../../components/AdminSidebar';
import { Types } from 'mongoose';

type ClientSideSourceConfig = {
  dataSourceId: string;
  achievementName: string;
  sponsorships: ISourceRewardSponsorship[];
};

export default function GGRewardsAdminPage() {

  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user } = useUserContext();
  const isMobile = useIsMobile();

  // Data State
  const [allAchievements, setAllAchievements] = useState<IAchievement[]>([]);
  const [allClients, setAllClients] = useState<IClient[]>([]);
  const [allDataSources, setAllDataSources] = useState<IDataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<IDataSource | null>(null);
  const [sourceConfigs, setSourceConfigs] = useState<ClientSideSourceConfig[]>([]);
  const [allRewards, setAllRewards] = useState<IReward[]>([]);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<"percent" | "dollars">("percent");
  const [discountProduct, setDiscountProduct] = useState<RewardProductName>('online store'); // Default
  const [productDescription, setProductDescription] = useState<string>(''); 
  const [minimumSpend, setMinimumSpend] = useState<number | null>(null);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(null);
  
  // Edit Mode State
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  // --- 1. RESET FORM ---
  const resetForm = () => {
    setSelectedClient('');
    setDiscountAmount(null); 
    setDiscountType('percent');
    setDiscountProduct('online store');
    setProductDescription('');
    setMinimumSpend(null);
    setMaxDiscount(null);
    setEditingRewardId(null);
    setError(null);
    setSuccessMsg(null);
  };

  useEffect(() => {
    resetForm();
  }, [selectedAchievement]);

  // --- 2. INITIAL FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [achRes, clientRes, dataSourceRes, rewardRes] = await Promise.all([
          fetch('/api/achievement/category/scope?scope=global'),
          fetch('/api/client'),
          fetch('/api/data-source'),
          fetch('/api/reward')
        ]);

        if (!achRes.ok || !clientRes.ok || !dataSourceRes.ok || !rewardRes.ok) {
          throw new Error('Failed to fetch required initial data.');
        }

        const achievementsData = await achRes.json();
        const clientsData = await clientRes.json();
        const dataSourcesData = await dataSourceRes.json();
        const rewardsData = await rewardRes.json();
        
        setAllAchievements(achievementsData.achievements || []);
        setAllClients(clientsData.clients || []);
        setAllDataSources(dataSourcesData.dataSources || []);
        setAllRewards(rewardsData.rewards || []);

        if (dataSourcesData.dataSources && dataSourcesData.dataSources.length > 0) {
          setSelectedDataSource(dataSourcesData.dataSources[0]);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 3. FETCH CONFIGS ---
  useEffect(() => {
    if (!selectedDataSource) return;

    const fetchSourceConfigs = async () => {
      // Don't set loading true here to avoid flickering on every change, 
      // rely on optimistic updates for speed.
      try {
        const res = await fetch(`/api/source-reward-config?dataSourceId=${selectedDataSource._id}`);
        if (!res.ok) {
          if (res.status === 404) return; // No configs yet is fine
          throw new Error('Failed to fetch reward configurations.');
        }
        const data = await res.json();
        
        // Transform flat rewards into grouped configs
        const groupedConfigs: Record<string, ClientSideSourceConfig> = {};
        for (const reward of data.rewards) {
          const achName = reward.achievement.name;
          if (!groupedConfigs[achName]) {
            groupedConfigs[achName] = {
              dataSourceId: selectedDataSource._id.toString(),
              achievementName: achName,
              sponsorships: []
            };
          }
          groupedConfigs[achName].sponsorships.push({
            sponsoringClientId: reward.sponsoringClient._id,
            rewardId: reward.reward._id
          });
        }
        setSourceConfigs(Object.values(groupedConfigs));
        
      } catch (err) {
        console.error(err);
      }
    };

    fetchSourceConfigs();
  }, [selectedDataSource]);

  useEffect(() => {
    if (!user) return;
    setAdminPermission(user.superAdmin ? 'admin' : 'associate');
  }, [user]);

  // --- 4. HANDLE EDIT CLICK ---
  const handleEdit = (sponsorship: ISourceRewardSponsorship) => {
    const reward = allRewards.find(r => r._id.toString() === sponsorship.rewardId.toString());
    if (!reward) {
        setError("Could not find reward details locally. Try refreshing.");
        return;
    }

    setEditingRewardId(reward._id.toString());
    setSelectedClient(sponsorship.sponsoringClientId.toString());
    
    // Populate form
    setDiscountAmount(reward.discount ?? null);
    setDiscountType(reward.type === 'dollars' ? 'dollars' : 'percent');
    setDiscountProduct(reward.product as RewardProductName);
    setProductDescription(reward.productDescription || "");
    setMinimumSpend(reward.minimumSpend ?? null);
    setMaxDiscount(reward.maxDiscount ?? null);
    
    // Scroll to form
    document.getElementById('reward-form')?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // --- 5. SAVE HANDLER (Create OR Update) ---
  const handleSaveGlobalReward = async () => {
    if (!selectedAchievement || !selectedClient || !selectedDataSource || !discountAmount) return;
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const friendlyName = `${discountType === 'dollars' ? '$' : ''}${discountAmount}${discountType === 'percent' ? '%' : ''} off ${productDescription ? productDescription : 'Entire Order'}`;

      type Category = "custom" | "programming" | "retail";
      const specialCategories: Record<string, Category> = {
          "custom": "custom",
          "pro shop": "retail",
          "online store": "retail"
      };
      const category: Category = specialCategories[discountProduct] || "programming";

      const slugName = `${discountAmount}-${discountType}-off-${productDescription || 'item'}`
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      const rewardPayload: Partial<IReward> = {
        friendlyName,
        name: slugName,
        type: discountProduct !== 'custom' ? discountType : undefined,
        category: category,
        product: discountProduct,
        productDescription: productDescription.trim() || undefined,
        discount: discountAmount ?? undefined,
        minimumSpend: minimumSpend ?? undefined,
        maxDiscount: maxDiscount ?? undefined,
      };

      let finalReward: IReward;

      if (editingRewardId) {
        // --- A: UPDATE EXISTING ---
        const updateRes = await fetch('/api/reward', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...rewardPayload, id: editingRewardId }), // Pass 'id' not '_id'
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update reward.');
        finalReward = updateData.reward;
        
        setSuccessMsg("Reward updated successfully.");

      } else {
        // --- B: CREATE NEW ---
        const rewardRes = await fetch('/api/reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewardPayload),
        });
        const rewardData = await rewardRes.json();
        if (!rewardRes.ok) throw new Error(rewardData.error || 'Failed to create reward.');
        finalReward = rewardData.reward;

        // Link new reward
        const configPayload = {
            dataSourceId: selectedDataSource._id,
            achievementName: selectedAchievement.name,
            sponsorship: {
                sponsoringClientId: selectedClient,
                rewardId: finalReward._id,
            },
        };

        const configRes = await fetch('/api/source-reward-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configPayload),
        });

        if (!configRes.ok) throw new Error('Failed to update GGR config.');
        
        // --- OPTIMISTIC CONFIG UPDATE (FIXED IMMUTABILITY) ---
        setSourceConfigs(prevConfigs => {
            const newSponsorship = { 
                sponsoringClientId: new Types.ObjectId(selectedClient), 
                rewardId: new Types.ObjectId(finalReward._id) 
            };
            
            const idx = prevConfigs.findIndex(c => c.achievementName === selectedAchievement.name);

            if (idx > -1) {
                // 1. Create a shallow copy of the array
                const next = [...prevConfigs];
                
                // 2. Create a shallow copy of the updated object inside the array
                next[idx] = {
                    ...next[idx],
                    sponsorships: [...next[idx].sponsorships, newSponsorship] // 3. Create a new array for sponsorships
                };
                
                return next;
            } else {
                return [...prevConfigs, {
                    dataSourceId: selectedDataSource._id.toString(),
                    achievementName: selectedAchievement.name,
                    sponsorships: [newSponsorship]
                }];
            }
        });

        setSuccessMsg("New sponsorship added.");
      }

      // Optimistic Reward Update (Update All Rewards List)
      setAllRewards(prev => {
        const idx = prev.findIndex(r => r._id === finalReward._id);
        if (idx > -1) {
            const next = [...prev];
            next[idx] = finalReward;
            return next;
        }
        return [...prev, finalReward];
      });

      // Cleanup
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- 6. REMOVE HANDLER ---
  const handleRemoveSponsorship = async (achievementName: string, rewardId: string) => {
    if (!selectedDataSource) return;

    setIsRemoving(rewardId);
    setError(null);

    try {
      const response = await fetch('/api/source-reward-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            dataSourceId: selectedDataSource._id, 
            achievementName, 
            rewardId 
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove sponsorship.');
      }

      // Optimistic update
      setSourceConfigs(prev => {
        const idx = prev.findIndex(c => c.achievementName === achievementName);
        if (idx > -1) {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                sponsorships: next[idx].sponsorships.filter(s => s.rewardId.toString() !== rewardId)
            };
            return next;
        }
        return prev;
      });
      
      // If we were editing this specific reward, clear the form
      if (editingRewardId === rewardId) {
          resetForm();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsRemoving(null);
    }
  };

  // --- RENDER HELPERS ---
  const currentSponsorships = useMemo(() => {
    if (!selectedAchievement) return [];
    const config = sourceConfigs.find(c => c.achievementName === selectedAchievement.name);
    return config ? config.sponsorships : [];
  }, [selectedAchievement, sourceConfigs]);

  const filteredAchievements = useMemo(() => {
    return allAchievements.filter(a => a.friendlyName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allAchievements, searchQuery]);

  // --- NEW: FILTER CLIENT LIST ---
  const availableClients = useMemo(() => {
    if (editingRewardId) return allClients; // Editing: allow current client
    
    // Create Set of client IDs that already sponsor this achievement
    const usedClientIds = new Set(currentSponsorships.map(s => s.sponsoringClientId.toString()));
    
    // Filter allClients to only show unused ones
    return allClients.filter(c => !usedClientIds.has(c._id.toString()));
  }, [allClients, currentSponsorships, editingRewardId]);

  const isSaveDisabled = useMemo(() => {
    if (isSaving || !selectedAchievement || !selectedClient) return true;
    if (discountProduct === 'custom') return !productDescription.trim();
    return !discountAmount || discountAmount <= 0;
  }, [isSaving, selectedAchievement, selectedClient, discountProduct, productDescription, discountAmount]);

  if (isLoading) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  const userName = user?.name;
  
  if (user && !user.superAdmin) {
    return <Flex height="100vh" align="center" justify="center"><Text>Access Denied</Text></Flex>;
  }

  return (
    <Flex direction="column" style={{ height: "100vh", backgroundColor: "#F9FAFB", overflow: "hidden" }}>
      
      {/* --- HEADER --- */}
      <Flex 
        justify="between" align="center" px="6" 
        style={{ height: '64px', backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}
      >
        <Flex align="center" gap="4">
          <Image src={darkGgLogo} alt="Logo" height={32} width={60} style={{ objectFit: 'contain' }} />
          <Separator orientation="vertical" style={{ height: '20px' }} />
          <Text weight="bold" size="3">Global Rewards Admin</Text>
        </Flex>
        
        <Flex align="center" gap="3">
          {!isMobile && (
            <Flex align="center" gap="2">
                <Text size="2" weight="bold">Data Source:</Text>
                <Select.Root 
                    value={selectedDataSource?._id.toString() || ''} 
                    onValueChange={(id) => setSelectedDataSource(allDataSources.find(ds => ds._id.toString() === id) || null)}
                >
                    <Select.Trigger placeholder="Select..." variant="surface" />
                    <Select.Content>
                    {allDataSources.map(ds => (
                        <Select.Item key={ds._id.toString()} value={ds._id.toString()}>
                        {ds.name}
                        </Select.Item>
                    ))}
                    </Select.Content>
                </Select.Root>
            </Flex>
          )}
          <Avatar fallback={userName?.charAt(0).toUpperCase() || 'A'} radius="full" size="2" />
        </Flex>
      </Flex>
      
      <Flex style={{ height: 'calc(100vh - 64px)' }}>
        
        {/* --- LEFT SIDEBAR (Nav) --- */}
        {!isMobile && <AdminSidebar adminPermission={adminPermission} />}

        {/* --- MIDDLE: ACHIEVEMENT LIST --- */}
        <Flex 
          direction="column" 
          width="320px" 
          style={{ backgroundColor: 'white', borderRight: '1px solid var(--gray-4)' }}
        >
          <Box p="4" pb="2">
            <TextField.Root placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}>
              <TextField.Slot><MagnifyingGlassIcon height="16" width="16" /></TextField.Slot>
            </TextField.Root>
          </Box>

          <ScrollArea type="hover" scrollbars="vertical">
            <Flex direction="column" p="2">
              {filteredAchievements.map(ach => {
                const configForAch = sourceConfigs.find(c => c.achievementName === ach.name);
                const count = configForAch ? configForAch.sponsorships.length : 0;
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
                      backgroundColor: isSelected ? 'var(--accent-3)' : 'transparent',
                      color: isSelected ? 'var(--accent-11)' : 'var(--gray-12)',
                      marginBottom: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    <Text size="2" weight={isSelected ? "bold" : "medium"}>{ach.friendlyName}</Text>
                    {count > 0 && <Badge color="green" radius="full">{count}</Badge>}
                  </Button>
                );
              })}
            </Flex>
          </ScrollArea>
        </Flex>

        {/* --- RIGHT: CONFIGURATION CANVAS --- */}
        <Flex flexGrow="1" justify="center" style={{ overflowY: 'auto' }} p="6">
          <Flex direction="column" maxWidth="800px" width="100%" gap="6">
            
            {selectedAchievement ? (
              <>
                <Flex direction="column" gap="1">
                    <Heading size="6">{selectedAchievement.friendlyName}</Heading>
                    <Text color="gray" size="2">Configure global rewards for this achievement.</Text>
                </Flex>

                {error && (
                    <Callout.Root color="red">
                        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                        <Callout.Text>{error}</Callout.Text>
                    </Callout.Root>
                )}
                {successMsg && (
                    <Callout.Root color="green">
                        <Callout.Icon><CheckCircledIcon /></Callout.Icon>
                        <Callout.Text>{successMsg}</Callout.Text>
                    </Callout.Root>
                )}

                {/* EXISTING SPONSORS */}
                {currentSponsorships.length > 0 && (
                    <Flex direction="column" gap="3">
                        <Text size="2" weight="bold" color="gray">CURRENT SPONSORS</Text>
                        <Card>
                            <Flex direction="column" gap="0">
                                {currentSponsorships.map((sp, idx) => {
                                    const clientName = allClients.find(c => c._id.toString() === sp.sponsoringClientId.toString())?.name || 'Unknown Client';
                                    const reward = allRewards.find(r => r._id.toString() === sp.rewardId.toString());
                                    const isDeleting = isRemoving === sp.rewardId.toString();
                                    const isEditing = editingRewardId === sp.rewardId.toString();

                                    return (
                                        <Box key={sp.rewardId.toString()}>
                                            {idx > 0 && <Separator size="4" />}
                                            <Flex justify="between" align="center" py="3">
                                                <Flex direction="column" gap="1">
                                                  <Flex direction={'row'} gap={'3'} align={'center'}>
                                                    <Text weight="bold" size="3">{clientName}</Text>
                                                    {isEditing && <Badge color="amber">Editing</Badge>}
                                                  </Flex>
                                                   
                                                    <Flex direction={'column'}>
                                                        <Text color="gray" size="2">
                                                            {reward?.friendlyName || "Reward Not Found"}
                                                        </Text>
                                                        {reward?.minimumSpend && (
                                                          <Text color='gray' size={'2'}>
                                                            Minimum spend: ${reward.minimumSpend}
                                                          </Text>
                                                        )}
                                                        
                                                    </Flex>
                                                </Flex>
                                                
                                                <Flex gap="3">
                                                    {/* EDIT BUTTON */}
                                                    <IconButton 
                                                        variant="ghost" 
                                                        color="gray"
                                                        onClick={() => handleEdit(sp)}
                                                        disabled={!!editingRewardId || isDeleting}
                                                    >
                                                        <Pencil1Icon />
                                                    </IconButton>

                                                    {/* DELETE BUTTON */}
                                                    <AlertDialog.Root>
                                                        <AlertDialog.Trigger>
                                                            <IconButton variant="ghost" color="red" disabled={isDeleting}>
                                                                {isDeleting ? <Spinner /> : <TrashIcon />}
                                                            </IconButton>
                                                        </AlertDialog.Trigger>
                                                        <AlertDialog.Content maxWidth="450px">
                                                            <AlertDialog.Title>Remove Sponsorship</AlertDialog.Title>
                                                            <AlertDialog.Description>Are you sure you want to remove this reward? This cannot be undone.</AlertDialog.Description>
                                                            <Flex gap="3" mt="4" justify="end">
                                                                <AlertDialog.Cancel><Button variant="soft" color="gray">Cancel</Button></AlertDialog.Cancel>
                                                                <AlertDialog.Action>
                                                                    <Button color="red" onClick={() => handleRemoveSponsorship(selectedAchievement.name, sp.rewardId.toString())}>Delete</Button>
                                                                </AlertDialog.Action>
                                                            </Flex>
                                                        </AlertDialog.Content>
                                                    </AlertDialog.Root>
                                                </Flex>
                                            </Flex>
                                        </Box>
                                    );
                                })}
                            </Flex>
                        </Card>
                    </Flex>
                )}

                {/* ADD / EDIT FORM */}
                <Flex direction="column" gap="3" id="reward-form">
                    <Flex justify="between" align="center">
                        <Text size="2" weight="bold" color="gray">
                            {editingRewardId ? "EDIT REWARD DETAILS" : "ADD NEW SPONSOR"}
                        </Text>
                        {editingRewardId && (
                            <Button variant="ghost" color="gray" size="1" onClick={resetForm}>
                                <Cross2Icon /> Cancel Edit
                            </Button>
                        )}
                    </Flex>
                    
                    <Card style={{ padding: '24px', border: editingRewardId ? '2px solid var(--accent-9)' : undefined }}>
                        <Flex direction="column" gap="5">
                            
                            {/* CLIENT SELECTOR - with empty state logic */}
                            <Flex direction="column" gap="2">
                                <Text size="2" weight="bold">Sponsoring Client</Text>
                                
                                {!editingRewardId && availableClients.length === 0 ? (
                                  <Callout.Root color="amber" size="1">
                                    <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                                    <Callout.Text>All available clients already sponsor this achievement.</Callout.Text>
                                  </Callout.Root>
                                ) : (
                                  <Select.Root 
                                      value={selectedClient} 
                                      onValueChange={setSelectedClient}
                                      disabled={!!editingRewardId} 
                                  >
                                      <Select.Trigger placeholder="Select a client..." />
                                      <Select.Content>
                                          {availableClients.map(client => (
                                              <Select.Item key={client._id.toString()} value={client._id.toString()}>
                                                {client.name}
                                              </Select.Item>
                                          ))}
                                      </Select.Content>
                                  </Select.Root>
                                )}
                            </Flex>

                            {/* Type Select */}
                            <Flex direction="column" gap="2">
                                <Text size="2" weight="bold">Product Type</Text>
                                <Select.Root value={discountProduct} onValueChange={(v) => setDiscountProduct(v as RewardProductName)}>
                                    <Select.Trigger />
                                    <Select.Content>
                                        <Select.Item value="custom">Custom Reward</Select.Item>
                                        <Select.Item value="open play">Open Play</Select.Item>
                                        <Select.Item value="reservations">Reservations</Select.Item>
                                        <Select.Item value="online store">Online Store</Select.Item>
                                        <Select.Item value="pro shop">Pro Shop</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </Flex>

                            {/* Discount Inputs */}
                            {discountProduct !== 'custom' && (
                                <Flex direction="column" gap="2">
                                    <Text size="2" weight="bold">Discount Amount</Text>
                                    <Flex gap="3">
                                        <TextField.Root 
                                            type="number" 
                                            placeholder="0" 
                                            value={discountAmount ?? ''} 
                                            onChange={(e) => setDiscountAmount(Number(e.target.value) || null)}
                                            style={{ flexGrow: 1 }} 
                                        />
                                        <SegmentedControl.Root value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "dollars")}>
                                            <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
                                            <SegmentedControl.Item value="dollars">$</SegmentedControl.Item>
                                        </SegmentedControl.Root>
                                    </Flex>
                                </Flex>
                            )}

                            {/* Advanced Options */}
                            {discountProduct !== 'custom' && (
                                <Flex gap="4">
                                    {discountType === 'dollars' && (
                                        <Box flexGrow="1">
                                            <Text size="2" weight="bold" mb="1">Min Spend</Text>
                                            <TextField.Root size="2" type="number" value={minimumSpend ?? ''} onChange={(e) => setMinimumSpend(Number(e.target.value) || null)}>
                                                <TextField.Slot>$</TextField.Slot>
                                            </TextField.Root>
                                        </Box>
                                    )}
                                </Flex>
                            )}

                            <Flex justify="end" mt="4" gap="3">
                                {editingRewardId && (
                                    <Button variant="soft" color="gray" onClick={resetForm}>Cancel</Button>
                                )}
                                <Button size="3" onClick={handleSaveGlobalReward} disabled={isSaveDisabled || isSaving}>
                                    {isSaving ? <Spinner /> : (editingRewardId ? "Update Reward" : "Add Sponsor")}
                                </Button>
                            </Flex>
                        </Flex>
                    </Card>
                </Flex>
              </>
            ) : (
              <Flex direction="column" align="center" justify="center" height="100%" style={{ opacity: 0.4, marginTop: '100px' }}>
                <MagicWandIcon width="64" height="64" />
                <Heading size="6" mt="4">Select an Achievement</Heading>
                <Text>Choose an item from the sidebar to configure rewards.</Text>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}