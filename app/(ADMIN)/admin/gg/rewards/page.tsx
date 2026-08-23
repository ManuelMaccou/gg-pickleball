'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { 
  Flex, Heading, Select, Button, Spinner, Text, Badge, TextField, AlertDialog, 
  Card, Separator, Box, ScrollArea, Callout, IconButton 
} from '@radix-ui/themes';
import { 
  CheckCircledIcon, InfoCircledIcon, MagnifyingGlassIcon, MagicWandIcon, TrashIcon, Pencil1Icon, Cross2Icon,
  ChevronLeftIcon,
} from "@radix-ui/react-icons";
import { 
  AdminPermissionType, IAchievement, IClient, IReward, ISourceRewardSponsorship 
} from '@/app/types/databaseTypes';
import { useUserContext } from '@/app/contexts/UserContext';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminSidebar } from '../../components/AdminSidebar';
import { Types } from 'mongoose';
import {
  DEFAULT_DISCOUNT_FORM_STATE,
  DiscountFormState,
  buildRewardPayloadFields,
  discountFormStateFromReward,
  targetSummaryText,
  validateDiscountForm,
} from '@/lib/rewards/discountFormState';
import { RewardDiscountForm } from '../../components/RewardDiscountForm';

type ClientSideSourceConfig = {
  achievementName: string;
  sponsorships: ISourceRewardSponsorship[];
};

export default function GGRewardsAdminPage() {

  const { user } = useUserContext();
  const isMobile = useIsMobile();

  // Data State
  const [allAchievements, setAllAchievements] = useState<IAchievement[]>([]);
  const [allClients, setAllClients] = useState<IClient[]>([]);
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
  // Desktop-only: controls the achievement-picker overlay drawer. Starts
  // open so there's something to pick from on first load. Mobile ignores
  // this entirely and keeps its own full-screen list/canvas swap.
  const [achievementDrawerOpen, setAchievementDrawerOpen] = useState(true);

  // Form State — every reward here is an 'online store' / 'retail' Shopify
  // reward, same as the brand admin page. The only thing this page adds on
  // top of that flow is picking WHICH client is sponsoring, since a single
  // achievement can have multiple sponsors here (unlike brand admin, where
  // there's only ever one — the logged-in admin's own store).
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(DEFAULT_DISCOUNT_FORM_STATE);
  
  // Edit Mode State
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  // --- 1. RESET FORM ---
  const resetForm = () => {
    setSelectedClient('');
    setDiscountForm(DEFAULT_DISCOUNT_FORM_STATE);
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
        const [achRes, clientRes, rewardRes] = await Promise.all([
          fetch('/api/achievement/category/scope?scope=global'),
          fetch('/api/client'),
          fetch('/api/reward')
        ]);

        if (!achRes.ok || !clientRes.ok || !rewardRes.ok) {
          throw new Error('Failed to fetch required initial data.');
        }

        const achievementsData = await achRes.json();
        const clientsData = await clientRes.json();
        const rewardsData = await rewardRes.json();
        
        setAllAchievements(achievementsData.achievements || []);
        setAllClients(clientsData.clients || []);
        setAllRewards(rewardsData.rewards || []);

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

    const fetchSourceConfigs = async () => {
      // Don't set loading true here to avoid flickering on every change, 
      // rely on optimistic updates for speed.
      try {
        const res = await fetch('/api/source-reward-config');
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
  }, []);

  useEffect(() => {
    if (!user) return;
    setAdminPermission(user.superAdmin ? 'admin' : 'associate');
  }, [user]);

  // Escape closes the achievement drawer, matching modal conventions —
  // lightweight overlay, not a full Radix Dialog, so no built-in focus
  // trap here.
  useEffect(() => {
    if (isMobile || !achievementDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAchievementDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, achievementDrawerOpen]);

  // --- SELECTED CLIENT LOOKUP — drives the Shopify-connection guard below ---
  const selectedClientObj = useMemo(
    () => allClients.find(c => c._id.toString() === selectedClient) ?? null,
    [allClients, selectedClient]
  );
  const selectedClientHasShopify = !!(
    selectedClientObj?.retailSoftware === 'shopify' &&
    selectedClientObj?.shopify?.accessToken
  );

  // Only used for the "add new sponsor" flow (the Select is disabled while
  // editing, so this never fires mid-edit). Resets discountForm on every
  // client change — without this, product/collection selections picked
  // for one client's catalog would silently carry over as state when
  // switching to a different client, even though those Shopify IDs mean
  // nothing (or something entirely different) in the new client's store.
  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    setDiscountForm(DEFAULT_DISCOUNT_FORM_STATE);
  };

  // --- 4. HANDLE EDIT CLICK ---
  const handleEdit = (sponsorship: ISourceRewardSponsorship) => {
    const reward = allRewards.find(r => r._id.toString() === sponsorship.rewardId.toString());
    if (!reward) {
        setError("Could not find reward details locally. Try refreshing.");
        return;
    }

    setEditingRewardId(reward._id.toString());
    setSelectedClient(sponsorship.sponsoringClientId.toString());
    // Reconstructs scope/BXGY selections (with real product/collection
    // names already snapshotted) from the persisted reward — same
    // function the brand admin page uses for the identical purpose.
    setDiscountForm(discountFormStateFromReward(reward));

    // Scroll to form
    document.getElementById('reward-form')?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // --- 5. SAVE HANDLER (Create OR Update) ---
  const handleSaveGlobalReward = async () => {
    if (!selectedAchievement || !selectedClient) return;

    const validationError = validateDiscountForm(discountForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      let friendlyName: string;
      let rawSlug: string;

      if (discountForm.discountKind === 'bxgy') {
        const off = discountForm.getPercent === 100 ? 'free' : `${discountForm.getPercent}% off`;
        friendlyName = `Buy ${discountForm.buyQuantity}, get ${discountForm.getQuantity} ${off}`;
        rawSlug = `buy-${discountForm.buyQuantity}-get-${discountForm.getQuantity}-${
          discountForm.getPercent === 100 ? 'free' : `${discountForm.getPercent}-percent-off`
        }`;
      } else {
        const scopeLabel =
          discountForm.scope === 'store' ? 'Entire Order' : targetSummaryText(discountForm.scopeSelection);
        friendlyName = `${discountForm.amountType === 'dollars' ? '$' : ''}${discountForm.amountValue}${
          discountForm.amountType === 'percent' ? '%' : ''
        } off ${scopeLabel}`;
        rawSlug = `${discountForm.amountValue}-${discountForm.amountType}-off-${scopeLabel}`;
      }

      const name = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      const rewardPayload: Partial<IReward> = {
        friendlyName,
        name,
        category: 'retail',
        product: 'online store',
        ...buildRewardPayloadFields(discountForm),
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

    setIsRemoving(rewardId);
    setError(null);

    try {
      const response = await fetch('/api/source-reward-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
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
    return !!validateDiscountForm(discountForm);
  }, [isSaving, selectedAchievement, selectedClient, discountForm]);

  if (isLoading) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  
  if (user && !user.superAdmin) {
    return <Flex height="100vh" align="center" justify="center"><Text>Access Denied</Text></Flex>;
  }

  // Mobile: unchanged concept from the brand admin page — a real
  // screen-size constraint, not a preference. This page never had mobile
  // handling before; adding it now alongside the drawer so mobile isn't
  // left showing a cramped fixed-width list next to the canvas.
  const showMobileList = isMobile && !selectedAchievement;
  const showMobileCanvas = isMobile && !!selectedAchievement;

  // Shared between the mobile in-flow panel and the desktop overlay
  // drawer — only the outer wrapper differs between the two.
  const achievementListInner = (
    <>
      <Flex justify="between" align="center" px="4" pt="4" pb="2">
        <Text size="2" weight="bold" color="gray">ACHIEVEMENTS</Text>
        {!isMobile && (
          <IconButton
            variant="ghost"
            color="gray"
            onClick={() => setAchievementDrawerOpen(false)}
            style={{ cursor: 'pointer' }}
          >
            <Cross2Icon />
          </IconButton>
        )}
      </Flex>
      <Box px="4" pb="2">
        <TextField.Root placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}>
          <TextField.Slot><MagnifyingGlassIcon height="16" width="16" /></TextField.Slot>
        </TextField.Root>
      </Box>

      <ScrollArea type="hover" scrollbars="vertical" style={{ flex: 1, minHeight: 0 }}>
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
                onClick={() => {
                  setSelectedAchievement(ach);
                  // No-op on mobile (drawer state unused there), closes
                  // the drawer on desktop — same click, both cases.
                  setAchievementDrawerOpen(false);
                }}
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
    </>
  );

  const canvasContent = selectedAchievement ? (
    <>
      <Button
        variant="ghost"
        color="gray"
        onClick={() => (isMobile ? setSelectedAchievement(null) : setAchievementDrawerOpen(true))}
        style={{ alignSelf: 'flex-start', padding: 0 }}
      >
        <ChevronLeftIcon width="20" height="20" /> Browse achievements
      </Button>

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
      <Flex direction="column" gap="4" id="reward-form">
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

          {/* Step 1 — the one piece of this flow with no equivalent on
              the brand admin page, since a brand admin only ever
              configures their own store. */}
          <Card style={{ padding: '24px', border: editingRewardId ? '2px solid var(--accent-9)' : undefined }}>
              <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">1. Sponsoring client</Text>
                  
                  {!editingRewardId && availableClients.length === 0 ? (
                    <Callout.Root color="amber" size="1">
                      <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                      <Callout.Text>All available clients already sponsor this achievement.</Callout.Text>
                    </Callout.Root>
                  ) : (
                    <Select.Root 
                        value={selectedClient} 
                        onValueChange={handleClientChange}
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
          </Card>

          {/* Step 2 — identical to the brand admin page's flow, just
              parameterized by whichever client was picked in step 1. */}
          {selectedClient && (
            !selectedClientHasShopify ? (
              <Callout.Root color="amber" size="1">
                <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                <Callout.Text>
                  {selectedClientObj?.name ?? 'This client'} isn't connected to Shopify — rewards need
                  an active Shopify connection.
                </Callout.Text>
              </Callout.Root>
            ) : (
              <RewardDiscountForm
                key={selectedClient}
                clientId={selectedClient}
                value={discountForm}
                onChange={(patch) => setDiscountForm((prev) => ({ ...prev, ...patch }))}
                editingLive={!!editingRewardId}
              />
            )
          )}

          <Flex justify="end" gap="3">
              {editingRewardId && (
                  <Button variant="soft" color="gray" onClick={resetForm}>Cancel</Button>
              )}
              <Button size="3" onClick={handleSaveGlobalReward} disabled={isSaveDisabled || isSaving}>
                  {isSaving ? <Spinner /> : (editingRewardId ? "Update Reward" : "Add Sponsor")}
              </Button>
          </Flex>
      </Flex>
    </>
  ) : (
    <Flex direction="column" align="center" justify="center" height="100%" gap="3" style={{ opacity: isMobile ? 1 : undefined, marginTop: isMobile ? 0 : '100px' }}>
      <Box style={{ opacity: 0.4 }}>
        <MagicWandIcon width="64" height="64" />
      </Box>
      <Heading size="6" color="gray">Select an Achievement</Heading>
      <Text color="gray">Choose an item from the list to configure rewards.</Text>
      {/* Fallback for the edge case where the drawer gets dismissed via
          backdrop/Escape before ever picking anything — it doesn't
          reopen on its own once closed once. */}
      {!isMobile && (
        <Button mt="2" onClick={() => setAchievementDrawerOpen(true)}>
          Browse achievements
        </Button>
      )}
    </Flex>
  );

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
      </Flex>
      
      <Flex style={{ height: 'calc(100vh - 64px)', position: 'relative' }}>
        
        {/* --- LEFT SIDEBAR (Nav) --- */}
        {!isMobile && <AdminSidebar adminPermission={adminPermission} />}

        {isMobile ? (
          <>
            {/* --- MOBILE: full-screen swap between list and canvas --- */}
            {showMobileList && (
              <Flex direction="column" width="100%" style={{ backgroundColor: 'white' }}>
                {achievementListInner}
              </Flex>
            )}
            {showMobileCanvas && (
              <Flex flexGrow="1" justify="center" style={{ overflowY: 'auto' }} p="6">
                <Flex direction="column" maxWidth="1100px" width="100%" gap="6">
                  {canvasContent}
                </Flex>
              </Flex>
            )}
          </>
        ) : (
          <>
            {/* --- DESKTOP: canvas always full width; list is an overlay drawer --- */}
            <Flex flexGrow="1" justify="center" style={{ overflowY: 'auto' }} p="6">
              <Flex direction="column" maxWidth="1100px" width="100%" gap="6">
                {canvasContent}
              </Flex>
            </Flex>

            <AnimatePresence>
              {achievementDrawerOpen && (
                <>
                  <motion.div
                    key="achievement-drawer-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setAchievementDrawerOpen(false)}
                    style={{
                      position: 'fixed',
                      top: 64,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(15,23,42,0.45)',
                      zIndex: 40,
                    }}
                  />
                  <motion.div
                    key="achievement-drawer"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                    style={{
                      position: 'fixed',
                      top: 64,
                      left: 0,
                      bottom: 0,
                      width: 320,
                      backgroundColor: 'white',
                      borderRight: '1px solid var(--gray-4)',
                      boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
                      zIndex: 41,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {achievementListInner}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </Flex>
    </Flex>
  );
}