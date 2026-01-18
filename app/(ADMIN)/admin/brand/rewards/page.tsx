'use client'

import { useEffect, useMemo, useState } from "react";
import { useUserContext } from "@/app/contexts/UserContext";
import { 
  Flex, Text, Heading, Button, Spinner, AlertDialog, 
  TextField, SegmentedControl, Card,
  Callout,
  Strong,
  Separator,
  Avatar,
  Box,
  ScrollArea,
  Badge
} from "@radix-ui/themes";
import { CheckCircledIcon, InfoCircledIcon, Link2Icon, MagicWandIcon, MagnifyingGlassIcon, StarFilledIcon, TrashIcon } from "@radix-ui/react-icons";
import { 
  AdminPermissionType,
  IAchievement, IClient, IDataSource, IReward, ISourceRewardSponsorship, RewardProductName 
} from "@/app/types/databaseTypes";
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import Image from "next/image";
import darkGgLogo from "../../../../../public/logos/gg_logo_black_transparent.png"
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- TYPES ---
type ClientSideSourceConfig = {
  dataSourceId: string;
  achievementName: string;
  sponsorships: ISourceRewardSponsorship[];
};

export default function BrandRewardConfigPage() {
  const { user } = useUserContext();
  const router = useRouter();
  
  const userId = user?.id
  
  // --- STATE ---
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
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
  
  // FIX: Typed state for configs
  const [sourceConfigs, setSourceConfigs] = useState<ClientSideSourceConfig[]>([]);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);

  // UI State
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form State
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<"percent" | "dollars">("percent");
  const [productDescription, setProductDescription] = useState("");
  const [minimumSpend, setMinimumSpend] = useState<number | null>(null);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(null);
  
  const [existingRewardId, setExistingRewardId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);

  const isMobile = useIsMobile();

  // --- 0. GET ADMIN PERMISSIONS ---
   useEffect(() => {
    if (!userId) return;
  
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          // Permission Denied
          setAdminError("You don't have permission to access this page.");
          setIsGettingAdmin(false); // Stop loading so we can show the error
          return;
        }

        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch admin data");
        }

        if (data.admin.permission) {
          setAdminPermission(data.admin.permission);
        }
  
        // IMPORTANT: Check permission level here if you have specific rules
        // For example: if (data.admin.permission !== 'admin') ...

        setLocation(data.admin.location);
      } catch (error: unknown) {
        console.error("Error fetching admin data:", error);
        setAdminError(error instanceof Error ? error.message : "Unknown error occurred");
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
          fetch('/api/reward') 
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
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [user]);

  // --- 2. FETCH CONFIGS (FIXED) ---
  useEffect(() => {
    // FIX: Check selectedDataSource?._id in the body AND dependency array
    if (!selectedDataSource?._id) return;

    const fetchConfigs = async () => {
      try {
        const res = await fetch(`/api/source-reward-config?dataSourceId=${selectedDataSource._id}`);
        const data = await res.json();
        
        if (res.ok) {
          // --- TRANSFORMATION LOGIC FROM WORKING PAGE ---
          // The API returns a flat list of rewards. We must group them by achievement name.
          const groupedConfigs: Record<string, ClientSideSourceConfig> = {};
          
          for (const reward of (data.rewards || [])) {
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
        }
      } catch (e) { console.error(e); }
    };
    fetchConfigs();
  }, [selectedDataSource?._id, isSaving, isRemoving]); // <--- FIX: Correct dependency

  // --- 3. POPULATE FORM ON SELECTION ---
  useEffect(() => {
    if (!selectedAchievement || !location) return;

    // Find if THIS client already sponsors THIS achievement
    const config = sourceConfigs.find(c => c.achievementName === selectedAchievement.name);
    
    // Robust check using toString()
    const sponsorship = config?.sponsorships?.find((s) => 
      s.sponsoringClientId.toString() === location._id.toString()
    );

    if (sponsorship) {
      // EDIT MODE: Find the reward details and fill the form
      const reward = allRewards.find(r => r._id.toString() === sponsorship.rewardId.toString());
      if (reward) {
        setExistingRewardId(reward._id.toString());
        setDiscountAmount(reward.discount || null);
        setDiscountType(reward.type === 'dollars' ? 'dollars' : 'percent');
        setProductDescription(reward.productDescription || "");
        setMinimumSpend(reward.minimumSpend || null);
        setMaxDiscount(reward.maxDiscount || null);
        return;
      }
    }

    // CREATE MODE: Reset form
    setExistingRewardId(null);
    setDiscountAmount(null);
    setDiscountType("percent");
    setProductDescription("");
    setMinimumSpend(null);
    setMaxDiscount(null);

  }, [selectedAchievement, location, sourceConfigs, allRewards]);


  // --- SAVE HANDLER ---
  const handleSave = async () => {
    if (!selectedAchievement || !location || !selectedDataSource || !discountAmount) return;

    // 1. Validation
    if (discountAmount <= 0) {
        setError("Discount amount must be greater than 0.");
        return;
    }
    if (discountType === 'percent' && discountAmount > 100) {
        setError("Percentage discount cannot exceed 100%.");
        return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      // 2. Construct Payload
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

      console.log("existingRewardId:", existingRewardId)

      if (existingRewardId) {
        // --- PATH A: UPDATE EXISTING ---
        const updateRes = await fetch('/api/reward', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            // We pass the ID in the body so the backend knows which doc to update
            body: JSON.stringify({ ...rewardPayload, id: existingRewardId }),
        });

        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update reward.');
        
        finalRewardObj = updateData.reward;

        // Note: We DO NOT need to call /api/source-reward-config here because
        // the link between Client <-> RewardId hasn't changed. We just changed the Reward details.

      } else {
        // --- PATH B: CREATE NEW ---
        const createRes = await fetch('/api/reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewardPayload),
        });

        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create reward.');
        
        finalRewardObj = createData.reward;
        
        // Only link configuration for new rewards
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

      // --- 3. STATE UPDATES ---
      const finalRewardId = finalRewardObj._id;

      // A. Update All Rewards List (Reflects changes in memory)
      setAllRewards(prev => {
        const exists = prev.findIndex(r => r._id === finalRewardId);
        if (exists > -1) {
            const next = [...prev];
            next[exists] = finalRewardObj; // Replace with updated version
            return next;
        }
        return [...prev, finalRewardObj]; // Add new
      });

      // B. Update Configs (Only strictly necessary for Create, but safe to run always)
      setSourceConfigs(prev => {
        const next = [...prev];
        const configIndex = next.findIndex(c => c.achievementName === selectedAchievement.name);
        const newSponsorship = { sponsoringClientId: location._id, rewardId: finalRewardId };

        if (configIndex > -1) {
            const existingSponsorshipIndex = next[configIndex].sponsorships.findIndex(
                s => s.sponsoringClientId.toString() === location._id.toString()
            );
            if (existingSponsorshipIndex > -1) {
                // Update existing link (rarely needed unless ID changed, but safe)
                next[configIndex].sponsorships[existingSponsorshipIndex] = newSponsorship;
            } else {
                next[configIndex].sponsorships.push(newSponsorship);
            }
        } else {
            next.push({
                dataSourceId: selectedDataSource._id.toString(),
                achievementName: selectedAchievement.name,
                sponsorships: [newSponsorship]
            });
        }
        return next;
      });

      setExistingRewardId(finalRewardId.toString()); 
      setSuccessMsg(existingRewardId ? "Reward updated successfully." : "Reward created successfully.");
      
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
      // Use the existing DELETE route that handles both config update + reward deletion
      const res = await fetch('/api/source-reward-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: selectedDataSource._id,
          achievementName: selectedAchievement.name,
          rewardId: existingRewardId // <--- Pass the Reward ID, not Client ID
        })
      });
        
      if(!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to remove sponsorship");
      }
      
      // --- OPTIMISTIC UPDATE ---
      
      // 1. Update Source Configs (Remove green dot logic)
      setSourceConfigs(prev => {
        const next = [...prev];
        const configIndex = next.findIndex(c => c.achievementName === selectedAchievement.name);
        
        if (configIndex > -1) {
            // Filter out the sponsorship for this reward ID
            next[configIndex].sponsorships = next[configIndex].sponsorships.filter(
                s => s.rewardId.toString() !== existingRewardId
            );
        }
        return next;
      });

      setSuccessMsg("Reward removed.");
      setExistingRewardId(null);
      setDiscountAmount(null);
      setProductDescription("");
      
      setTimeout(() => setSuccessMsg(null), 3000);

    } catch(err) {
        setError(err instanceof Error ? err.message : "Failed to remove reward");
    } finally {
        setIsRemoving(false);
    }
  };

  useEffect(() => {
    setSuccessMsg(null);
    setError(null);
  }, [selectedAchievement]); 

  const filteredAchievements = useMemo(() => {
    return allAchievements.filter(a => 
      a.friendlyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allAchievements, searchQuery]);

  const isShopifyConnected = location?.retailSoftware === 'shopify' && 
    location?.shopify?.shopDomain &&
    location?.shopify?.accessToken;

  const isSaveDisabled = !discountAmount;
  const userName = user?.name;

  // --- LIVE PREVIEW GENERATOR ---
  const previewText = useMemo(() => {
    if (!discountAmount) return "Reward Value";
    return `${discountType === 'dollars' ? '$' : ''}${discountAmount}${discountType === 'percent' ? '%' : ''} off`;
  }, [discountAmount, discountType]);

  const previewDescription = productDescription || "Entire cart";

  if (isLoading || isGettingAdmin) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;

   if (adminError) {
    return (
        <Flex direction="column" height="100vh" align="center" justify="center" gap="4">
            <Text color="red" size="4">{adminError}</Text>
            <Button onClick={() => window.location.href = '/'}>Go Home</Button>
        </Flex>
    )
  }

  if (!location) {
      return (
        <Flex direction="column" height="100vh">
          {/* Header Reuse (Simplified for error state) */}
          <Flex justify="between" align="center" px="6" py="4" style={{borderBottom: '1px solid var(--gray-4)'}}>
            <Image src={darkGgLogo} alt="Logo" height={32} width={60} />
            <Text>{user?.name}</Text>
          </Flex>
          <Flex direction="column" align="center" justify="center" flexGrow="1">
            <Heading mb="2">Access Denied</Heading>
            <Text color="gray">You do not have a client configuration associated with your account.</Text>
          </Flex>
        </Flex>
      );
  }

  if (user && !user.superAdmin) {
      return (
        <Flex direction="column" height="100vh">
          {/* Header Reuse */}
          <Flex justify="between" align="center" direction="row" px={{ initial: '3', md: '9' }} py="4">
            <Flex direction="column" position="relative" maxWidth="80px">
              <Image src={darkGgLogo} alt="GG Pickleball dark logo" priority height={540} width={960} />
            </Flex>
            {!auth0IsLoading && (
              <Flex direction="row" justify="center" align="center">
                <Text size="3" weight="bold" align="right">
                  {userName ? (auth0User ? `Welcome ${String(userName).includes('@') ? String(userName).split('@')[0] : userName}` : `${String(userName).includes('@') ? String(userName).split('@')[0] : userName} (guest)`) : ''}
                </Text>
              </Flex>
            )}
          </Flex>
          <Flex direction="column" align="center" justify="center" height="300px">
            <Text>You do not have access to this page</Text>
          </Flex>
        </Flex>
      );
  }

  return (
    <Flex direction={'column'} style={{ backgroundColor: "#F9FAFB", height: "100vh", overflow: "hidden" }}>
      
      {/* --- HEADER --- */}
      <Flex 
        justify={"between"} 
        align={'center'} 
        height={'64px'} 
        px={'6'} 
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}
      >
        <Flex align="center" gap="4">
          <Image src={darkGgLogo} alt="Logo" height={32} width={60} style={{ objectFit: 'contain' }} />
          <Separator orientation="vertical" style={{ height: '20px' }} />
          <Text weight="bold" size="3">Configure Rewards</Text>
        </Flex>
        
        {!auth0IsLoading && (
          <Flex align="center" gap="3">
            
            {/* --- SHOPIFY STATUS BUTTON --- */}
             {location?.retailSoftware === 'shopify' && (
              <>
                <Button 
                  size="2" 
                  variant={isShopifyConnected ? "soft" : "outline"} 
                  color={isShopifyConnected ? "green" : "gray"}
                  style={{ cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => router.push('/admin/brand/onboard-shopify')}
                >
                    {isShopifyConnected ? (
                      <>
                        <CheckCircledIcon width="16" height="16" />
                        Shopify Active
                      </>
                    ) : (
                      <>
                        <Link2Icon width="16" height="16" />
                        Connect Shopify
                      </>
                    )}
                  </Button>

                <Separator orientation="vertical" style={{ height: '20px' }} />
              </>

             )}
             <Avatar
                size="2" 
                fallback={userName?.charAt(0).toUpperCase() || "A"} 
                radius="full" 
                color="gray" 
                variant="soft"
             />
          </Flex>
        )}
      </Flex>

      {/* --- MAIN LAYOUT --- */}
      <Flex style={{ height: 'calc(100vh - 64px)' }}>
        {/* --- SIDEBAR (Desktop) --- */}
        {!isMobile && adminPermission === 'admin' && (
          <Flex direction={'column'} width={'180px'} py={'4'} px={'3'} style={{ backgroundColor: 'white', borderRight: '1px solid var(--gray-4)' }}>
            <Flex direction={'column'} gap={'1'}>
              <Link href={'/admin/brand'} style={{ textDecoration: 'none' }}>
                <Button variant="ghost" color="gray" style={{ width: '100%', justifyContent: 'start' }}>Dashboard</Button>
              </Link>
              <Link href={'/admin/brand/rewards'} style={{ textDecoration: 'none' }}>
                <Button variant="ghost" color="gray" style={{ width: '100%', justifyContent: 'start', textDecoration: 'underline'}}>Configure rewards</Button>
              </Link>
            </Flex>
          </Flex>
        )}
        
        {/* --- LEFT SIDEBAR: NAVIGATION --- */}
        <Flex 
          direction="column" 
          width="320px" 
          style={{ backgroundColor: 'white', borderRight: '1px solid var(--gray-4)' }}
        >
          {/* Search Header 
          <Box p="4" pb="2">
            <TextField.Root placeholder="Search achievements..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}>
              <TextField.Slot><MagnifyingGlassIcon height="16" width="16" /></TextField.Slot>
            </TextField.Root>
          </Box>
          */}

          {/* Scrollable List */}
          <ScrollArea type="hover" scrollbars="vertical">
            <Flex direction="column" p="2">
              {filteredAchievements.map(ach => {
                const configForAch = sourceConfigs.find(c => c.achievementName === ach.name);
                const isSponsored = configForAch?.sponsorships?.some((s) => 
                    s.sponsoringClientId.toString() === location?._id.toString()
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
                      backgroundColor: isSelected ? 'var(--accent-3)' : 'transparent',
                      color: isSelected ? 'var(--accent-11)' : 'var(--gray-12)',
                      marginBottom: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    <Flex align="center" gap="3">
                      <Box 
                        style={{ 
                          width: '8px', height: '8px', borderRadius: '50%', 
                          backgroundColor: isSponsored ? 'var(--green-9)' : 'var(--gray-5)' 
                        }} 
                      />
                      <Flex direction="column" align="start">
                        <Text weight={isSelected ? "bold" : "medium"} size="2">{ach.friendlyName}</Text>
                        <Text size="1" color={isSelected ? undefined : "gray"}>
                            {ach.name.length > 25 ? ach.name.substring(0, 25) + '...' : ach.name}
                        </Text>
                      </Flex>
                    </Flex>
                    {isSponsored && <CheckCircledIcon color="green" />}
                  </Button>
                );
              })}
            </Flex>
          </ScrollArea>
        </Flex>

        {/* --- RIGHT CONTENT: CANVAS --- */}
        <Flex flexGrow="1" justify="center" style={{ overflowY: 'auto', position: 'relative' }} p="6">
          
          {selectedAchievement ? (
            <Flex direction="column" maxWidth="800px" width="100%" gap="6">
              
              {/* Header */}
              <Flex justify="between" align="center">
                <Box>
                  <Heading size="6" mb="1">{selectedAchievement.friendlyName}</Heading>
                  <Text size="2" color="gray">Configure the reward players receive when earning this achievement.</Text>
                </Box>
                {existingRewardId && <Badge color="green" size="2"><CheckCircledIcon /> Active</Badge>}
              </Flex>

              <Separator size="4" />

              <Flex gap="8" align="start" direction={{ initial: 'column', lg: 'row' }}>
                
                {/* 1. FORM SECTION */}
                <Flex direction="column" gap="5" flexGrow="1" width="100%">
                  <Card size="3" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Flex direction="column" gap="5">
                      
                     <Flex direction={'column'} gap={'3'}>
                        <Text size="2" weight="bold" color="gray">REWARD DETAILS</Text>
                        {(successMsg || error) && (
                          <Callout.Root color={error ? "red" : "green"} size="1">
                            <Callout.Icon>
                                {error ? <InfoCircledIcon /> : <CheckCircledIcon />}
                            </Callout.Icon>
                            <Callout.Text>{error || successMsg}</Callout.Text>
                          </Callout.Root>
                        )}
                      </Flex>

                      <Flex direction="column" gap="4">
                        {/* Discount Row */}
                        <Flex gap="4">
                          <Box flexGrow="1">
                            <Text size="2" weight="bold" mb="1">Amount</Text>
                            <TextField.Root 
                                size="3"
                                type="number" 
                                placeholder="0" 
                                value={discountAmount ?? ''} 
                                onChange={(e) => setDiscountAmount(Number(e.target.value) || null)} 
                            />
                          </Box>
                          <Box width="120px">
                            <Text size="2" weight="bold" mb="1">Type</Text>
                            <SegmentedControl.Root size="3" value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "dollars")}>
                                <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
                                <SegmentedControl.Item value="dollars">$</SegmentedControl.Item>
                            </SegmentedControl.Root>
                          </Box>
                        </Flex>

                        {/* Description 
                        <Box>
                          <Text size="2" weight="bold" mb="1">Applies To</Text>
                          <TextField.Root 
                              size="3"
                              placeholder="e.g. All branded apparel" 
                              value={productDescription} 
                              onChange={(e) => setProductDescription(e.target.value)} 
                          />
                          <Text size="1" color="gray" mt="1">Leave blank to apply to the entire store.</Text>
                        </Box>
                        */}

                        {/* Advanced Options */}
                        <Flex gap="4">
                          {discountType === 'dollars' && (
                            <Box flexGrow="1">
                              <Text size="2" weight="bold" mb="1">Min Spend</Text>
                              <TextField.Root size="3" type="number" value={minimumSpend ?? ''} onChange={(e) => setMinimumSpend(Number(e.target.value) || null)}>
                                  <TextField.Slot>$</TextField.Slot>
                              </TextField.Root>
                            </Box>
                          )}
                        </Flex>
                      </Flex>

                      <Separator size="4" />

                      {/* Actions */}
                      <Flex justify="between" align="center">
                        {existingRewardId ? (
                           <Button variant="ghost" color="red" onClick={handleRemove} disabled={isRemoving}>
                             <TrashIcon /> Remove Reward
                           </Button>
                        ) : <Box />}
                        
                        <Flex gap="3">
                          <Button size="3" onClick={handleSave} loading={isSaving} disabled={isSaveDisabled}>
                            {existingRewardId ? "Save Changes" : "Create Reward"}
                          </Button>
                        </Flex>
                      </Flex>

                    </Flex>
                  </Card>
                </Flex>

                {/* 2. PREVIEW SECTION */}
                <Flex direction="column" width={{ initial: '100%', lg: '320px' }} gap="3">
                  <Text size="2" weight="bold" color="gray">PLAYER PREVIEW</Text>
                  
                  {/* Mock Phone Card */}
                  <Box 
                    style={{ 
                      backgroundColor: location?.bannerColor || 'var(--accent-9)', 
                      borderRadius: '16px', 
                      height: '200px', 
                      padding: '20px',
                      color: location?.cardTextColor || 'white',
                      position: 'relative',
                      boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Flex justify="between" align="start">
                      <Text size="5" weight="bold" style={{ lineHeight: '1.2' }}>{previewText}</Text>
                      {/* Using the actual brand logo if available */}
                      <Box 
                        style={{ 
                          width: '80px', height: 'auto', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                         {location?.logo ? (
                           <img src={location.logo} alt="logo" style={{width: '80%', height: '80%', objectFit: 'contain'}} />
                         ) : <StarFilledIcon color="gold" />}
                      </Box>
                    </Flex>

                    <Flex direction="column">
                      <Text size="2" style={{ opacity: 0.9 }}>{previewDescription}</Text>
                      <Text size="1" style={{ opacity: 0.7, marginTop: '4px' }}>
                        Earned via: {selectedAchievement.friendlyName}
                      </Text>
                    </Flex>
                  </Box>

                  <Callout.Root size="1" variant="surface">
                    <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                    <Callout.Text>
                      This is how the reward card will appear in the player&apos;s digital wallet.
                    </Callout.Text>
                  </Callout.Root>
                </Flex>

              </Flex>
            </Flex>
          ) : (
            // Empty State
            <Flex direction="column" align="center" justify="center" height="100%" style={{ opacity: 0.4 }}>
              <MagicWandIcon width="64" height="64" />
              <Heading size="6" mt="4">Select an Achievement</Heading>
              <Text>Choose an item from the sidebar to configure rewards.</Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
