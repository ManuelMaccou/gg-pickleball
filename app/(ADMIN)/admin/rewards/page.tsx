'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { AlertDialog, Badge, Button, Callout, Em, Flex, Heading, SegmentedControl, Select, Spinner, Text, TextField } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png'
import { IAchievement, IAdmin, IClient, IReward } from "@/app/types/databaseTypes";
import Link from "next/link";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import MobileMenu from "../components/MobileMenu";
import MobileConfigureRewardsForm from "../components/MobileConfigureRewardsForm";

export default function GgpickleballAdminRewards() {

  const { user } = useUserContext();
  const router = useRouter();
  const isMobile =useIsMobile();

  const userId = user?.id
  const userName = user?.name
  
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [isMobileRewardOpen, setIsMobileRewardOpen] = useState(false);
  const [admin, setAdmin] = useState<IAdmin | null>(null);
  const [location, setLocation] = useState<IClient | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [configuredClientAchievements, setConfiguredClientAchievements] = useState<IAchievement[]>([]);
  const [configuredClientRewards, setConfiguredClientRewards] = useState<Record<string, IReward> | null>(null);
  const [rewardConfigStatus, setRewardConfigStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<"percent" | "dollars">("percent");
  const [discountProduct, setDiscountProduct] = useState<"open play" | "reservation" | "pro shop">("reservation");
  const [minimumSpendAmount, setMinimumSpendAmount] = useState<number | null>(null);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | null>(null);
  const [rewardSuccess, setRewardSuccess] = useState<boolean>(false);
  const [rewardError, setRewardError] = useState<boolean>(false);
  const [isSavingReward, setIsSavingReward] = useState<boolean>(false);
  const [isRemovingReward, setIsRemovingReward] = useState<boolean>(false);

  // Get admin data
  useEffect(() => {
    if (!userId) return;
  
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          setAdmin(null);
          setAdminError("You don't have permission to access this page.");
          return;
        }

        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch admin data");
        }
  
        setAdmin(data.admin);
        setLocation(data.admin.location);
      } catch (error: unknown) {
        console.error("Error fetching admin data:", error);
      
        if (error instanceof Error) {
          setAdminError(error.message);
        } else {
          setAdminError("Unknown error occurred");
        }
      
        setAdmin(null);
      } finally {
        setIsGettingAdmin(false);
      }
    };
  
    getAdminUser();
  }, [userId]);

  // Get current client details
  useEffect(() => {
    if (!location) return

    const getClientAchievements = async () => {
      try {
        const achievementContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';
        const rewardContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';

        const response = await fetch(`/api/client/achievements?clientId=${location._id}&achievementContext=${achievementContext}&rewardContext=${rewardContext}`);
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch updated client data");
        }
  
        setConfiguredClientAchievements(data.achievements);
        setConfiguredClientRewards(data.rewardsPerAchievement);
        setRewardConfigStatus(data.rewardConfigStatus);

        console.log("status:", data.rewardConfigStatus)

      } catch (error: unknown) {
        console.error("Error fetching updated client data:", error);
        if (error instanceof Error) {
          console.error(error.message);
          setAdminError('An error occured. Please try again later.')
        } else {
          console.error("Unknown error occurred");
          setAdminError('An error occured. Please try again later.')
        }
      }
    };

    getClientAchievements();
  }, [location])

  // Get existing rewards details for selected achievement
  useEffect(() => {
    const fetchRewardForSelectedAchievement = async () => {
      if (!selectedAchievement || !configuredClientRewards) return;

      const reward = configuredClientRewards[selectedAchievement.name];
      const rewardId = reward?._id;
      console.log('rewardId:', rewardId)

      if (!rewardId) {
        // Reset to defaults
        setDiscountAmount(null);
        setDiscountProduct("reservation");
        setDiscountType("percent");
        return;
      }

      try {
        const res = await fetch(`/api/reward?id=${rewardId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch reward");
        }

        const reward: IReward = data.reward;

        setDiscountAmount(reward.discount);
        setDiscountProduct(reward.product as "open play" | "reservation" | "pro shop");
        setDiscountType(reward.type as "percent" | "dollars");
        setMaxDiscountAmount(reward.maxDiscount ?? null);
        setMinimumSpendAmount(reward.minimumSpend ?? null);
      } catch (err) {
        console.error("Error loading reward for achievement:", err);
      }
    };

    fetchRewardForSelectedAchievement();
  }, [selectedAchievement, configuredClientRewards]);

  const handleSaveReward = async () => {
    if (!selectedAchievement) return;

    setIsSavingReward(true);
    setRewardSuccess(false);
    setRewardError(false);

    const discountPrefix = discountType === "dollars" ? `$${discountAmount}` : `${discountAmount}%`;
    const discountName = `${discountPrefix}-off-${discountProduct}`.toLowerCase();
    const friendlyName = `${discountPrefix} off`;

    let maxDiscount: number | null = null;
    let minimumSpend: number | null = null;

    if (discountType === 'percent') {
      maxDiscount = !isNaN(Number(maxDiscountAmount)) ? Number(maxDiscountAmount) : null;
      minimumSpend = null;
    } else if (discountType === 'dollars') {
      minimumSpend = !isNaN(Number(minimumSpendAmount)) ? Number(minimumSpendAmount) : null;
      maxDiscount = null;
    }

    const existingReward = configuredClientRewards?.[selectedAchievement.name];
    const existingRewardId = existingReward?._id

    const rewardPayload = {
      discount: discountAmount,
      product: discountProduct,
      name: discountName,
      type: discountType,
      maxDiscount,
      minimumSpend,
      friendlyName,
      category: discountProduct === "pro shop" ? "retail" : "programming"
    };

    try {
      const rewardResponse = await fetch(
        existingRewardId ? `/api/reward?id=${existingRewardId}` : `/api/reward`,
        {
          method: existingRewardId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(existingRewardId?.toString() && { id: existingRewardId.toString() }),
            ...rewardPayload
          }),
        }
      );

      const rewardData = await rewardResponse.json();

      if (!rewardResponse.ok) {
        setRewardError(true);
        throw new Error(rewardData.error || "Failed to save reward");
      }

      const rewardId = rewardData.reward._id;
      if (!rewardId) {
        setRewardError(true);
        throw new Error(rewardData.error || "Reward save failed — no ID returned");
      }

      const reward = rewardData.reward;
      console.log('reward:', reward)

      setDiscountAmount(reward.discount);
      setDiscountProduct(reward.product as "open play" | "reservation" | "pro shop");
      setDiscountType(reward.type as "percent" | "dollars");
      setMinimumSpendAmount(reward.minimumSpendAmount);
      setMaxDiscountAmount(reward.maxDiscountAmount);

      setConfiguredClientRewards(prev => ({
        ...(prev || {}),
        [selectedAchievement.name]: reward
      }));


      if (!existingRewardId) {
        const rewardContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';

        const patchResponse = await fetch('/api/client', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: location?._id,
            rewardsPerAchievement: {
              [selectedAchievement.name]: rewardId,
            },
            rewardContext,
            mergeRewards: true,
          }),
        });
    
        const patchData = await patchResponse.json();

        if (!patchResponse.ok) {
          setRewardError(true);
          throw new Error(patchData.error || "Failed to update client");
        }

        setConfiguredClientRewards(prev => ({
          ...(prev || {}),
          [selectedAchievement.name]: reward,
        }));
      }
      setRewardSuccess(true);
    } catch (error) {
      setRewardError(true);
      console.error("Error saving reward:", error);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleRemoveReward = async () => {
     if (!selectedAchievement || !configuredClientRewards) return;

    setIsRemovingReward(true);
    setRewardError(false);
    setRewardSuccess(false);

    const reward = configuredClientRewards[selectedAchievement.name];
    const rewardId = reward?._id;

    try {
       // Delete the reward itself
      if (rewardId) {
        const deleteResponse = await fetch(`/api/reward?id=${rewardId}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          throw new Error(errorData.error || 'Failed to delete reward');
        }
      }

      // Remove reference from client
      const rewardContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';

      const patchResponse = await fetch('/api/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: location?._id,
          removeRewardForAchievement: [selectedAchievement.name],
          rewardContext,
        }),
      });

      const patchData = await patchResponse.json();

      if (!patchResponse.ok) {
        setRewardError(true)
        throw new Error(patchData.error || "Failed to remove reward for client");
      }

      setConfiguredClientRewards(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        delete updated[selectedAchievement.name];
        return updated;
      });
      setDiscountAmount(null)
      setDiscountProduct("reservation")
      setDiscountType("percent")
      setRewardSuccess(true)

    } catch (error: unknown) {
      setRewardError(true)
      console.error("Error removing reward for client:", error);
    } finally {
      setIsRemovingReward(false);
    }
  };

  // Final loading status
  useEffect(() => {
    if (!isGettingAdmin) {
      setIsLoading(false)
    }
  }, [isGettingAdmin])

  const isSelectedAchievementConfigured = Boolean(
    selectedAchievement?.name &&
    configuredClientRewards &&
    selectedAchievement.name in configuredClientRewards
  );

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin/rewards`)
    }
  })

  if (isMobile === null) {
    return null;
  }
  
  return (
    <Flex direction={'column'} height={'100vh'} >

      {/* Header */}
      <Flex justify={"between"} align={'center'} direction={"row"} px={{initial: '3', md: '9'}} py={'4'}>
        <Flex direction={'column'} position={'relative'} maxWidth={'80px'}>
          <Image
            src={darkGgLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
          />
        </Flex>

        {!auth0IsLoading && (
          <Flex direction={'row'} justify={'center'} align={'center'}>
            <Text size={'3'} weight={'bold'} align={'right'}>
              {userName ? (
                auth0User 
                  ? `Welcome ${String(userName).includes('@') ? String(userName).split('@')[0] : userName}`
                  : `${String(userName).includes('@') ? String(userName).split('@')[0] : userName} (guest)`
              ) : ''}
            </Text>

            {isMobile && (
              <MobileMenu />
            )}

          </Flex>
        )}
      </Flex>
       
      {/* Location Logo */}
      {location && (
        <Flex direction={'column'} style={{backgroundColor: admin?.bannerColor, boxShadow: rewardConfigStatus === 'pending' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : '', zIndex: 2}}>
          <Flex direction={'column'} position={'relative'} height={{initial: '60px', md: '80px'}} my={'5'}>
            <Image
              src={location.admin_logo}
              alt="Location logo"
              priority
              fill
              style={{objectFit: 'contain'}}
            />
          </Flex>
        </Flex>
      )}

      {/* Reward config status banner */}
      {rewardConfigStatus === "pending" && (
        <Flex direction={'column'} py={'3'} justify={'center'} align={'center'} style={{backgroundColor: "red", boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', zIndex: 2}}>
          <Text weight={'bold'} style={{color: 'white'}}>Please allow 24 hours for changes to take effect.</Text>
        </Flex>
      )}

      {/* Dashboard */}
      <Flex direction={'column'} height={"100%"} width={'100vw'} maxWidth={'1500px'} overflow={'hidden'} px={'4'} style={{alignSelf: 'center'}}>
        {adminError ? (
          <>
            <Flex direction={'column'} justify={'center'} gap={'4'} display={'flex'}>
              <Callout.Root size={'3'} color="red" >
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  {adminError}
                </Callout.Text>
              </Callout.Root>
            </Flex>
          </>
        ) : isLoading ? (
          <Flex direction={'column'} justify={'center'} align={'center'} mt={'9'}>
            <Spinner size={'3'} style={{color: 'black'}} />
          </Flex>
        ) : (
          <Flex direction={'row'} height={'100%'}>
            
            {/* Left sidebar nav */}
            {!isMobile && (
              <Flex direction={'column'} width={'250px'} py={'4'} px={'2'} style={{backgroundColor: '#F1F1F1', borderRight: '1px solid #d3d3d3'}}>
                <Flex direction={'column'} gap={'3'} px={'2'}>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin'}>Dashboard</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/achievements'}>Set achievements</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/rewards'} style={{backgroundColor: 'white', borderRadius: '10px'}}>Configure rewards</Link>
                  </Flex>
                </Flex>
              </Flex>
            )}

            {/* Container */}
            <Flex direction={'column'} py={'4'} width={'100%'}>
               <Heading mx={{initial: '0', md: '6'}} mb={'6'}>Configure Rewards</Heading>
              <Flex direction={'row'} height={'100%'} width={'100%'}>

                {/* Configured achievements */}
                <Flex direction={'column'} width={{initial: '100%', md: '50%'}} px={{initial: '0', md: '6'}} overflow={'scroll'} style={{...(isMobile ? {} : {borderRight: '1px solid #d3d3d3', paddingBottom: '100px'})}}>
                  <Text size={'3'} mb={'3'}>Select an achievement</Text>
                  {!configuredClientAchievements.length ? (
                    <Flex direction={'column'} gap={'5'} align={'center'}>
                      <Text size="2" color="gray">
                        Select the achievements you would like to make available before configuring rewards.
                      </Text>
                      <Button
                        color="blue"
                        variant="soft"
                        asChild>
                          <Link href={"/admin/achievements"} style={{width: '250px'}}>
                            Select your first achievement
                          </Link>
                        </Button>
                    </Flex>
                  ) : (
                    <Flex direction={'column'} mb={{initial: '9', md: '0'}}>
                      {configuredClientAchievements
                      .slice()
                      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
                      .map((clientAchievement) => {
                      const isConfigured = configuredClientRewards && clientAchievement.name in configuredClientRewards;

                        return (
                          <Flex
                            key={clientAchievement._id.toString()}
                            direction={'row'}
                            justify={'between'}
                            gap="1"
                            onClick={() => {
                              setSelectedAchievement(clientAchievement);
                              if (isMobile) setIsMobileRewardOpen(true);
                            }}
                            style={{
                              cursor: 'pointer',
                              border: '1px solid #e0e0e0',
                              padding: '0.75rem',
                              marginBottom: '0.5rem',
                              borderRadius: '6px',
                              background: selectedAchievement?._id.toString() === clientAchievement._id.toString() ? '#e6f7ff' : '#fafafa',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            <Text weight="bold">
                              {clientAchievement.friendlyName.charAt(0).toUpperCase() +
                                clientAchievement.friendlyName.slice(1)}
                            </Text>

                            {isConfigured && (
                              <Badge color="green">
                                Reward set
                              </Badge>
                            )}
                            
                          </Flex>
                        );
                      })}
                    </Flex>
                  )}
                </Flex>

                {/* Associate reward to achievement */}
                {!isMobile && (
                  <Flex direction="column" width="50%" px="6" gap={'3'} overflow={'auto'} pb={'9'}>
                    <Text size="3">Set reward</Text>

                    {selectedAchievement ? (
                      <Flex direction={'column'} gap={'5'}>
                        <Flex direction={'column'}>
                          <Text size="4" weight="bold">
                            {selectedAchievement.friendlyName.charAt(0).toUpperCase() + selectedAchievement.friendlyName.slice(1)}
                          </Text>
                        </Flex>
                        <Flex direction={'column'} gap={'5'} maxWidth={'80%'}>

                          <Flex direction={'column'} gap={'2'}>
                            <Text size={'3'}>Discount</Text>
                            <Flex direction={'row'} gap={'3'} justify={'between'} width={'100%'} flexGrow={'1'}>
                              <TextField.Root
                                type="number"
                                placeholder="Discount amount"
                                value={discountAmount ?? ''}
                                style={{flexGrow: '1'}}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const numeric = Number(value);
                                  setDiscountAmount(value === '' || isNaN(numeric) ? null : numeric);
                                }}
                              />
                              <SegmentedControl.Root
                                value={discountType}
                                onValueChange={(value) => {
                                  setDiscountType(value as "percent" | "dollars");
                                }}
                              >
                                <SegmentedControl.Item value="percent">Percent</SegmentedControl.Item>
                                <SegmentedControl.Item value="dollars">Dollars</SegmentedControl.Item>
                              </SegmentedControl.Root>
                            </Flex>
                          </Flex>

                          <Flex direction={'column'} gap={'2'}>
                            <Text size={'3'}>Product</Text>
                            <Text size={'1'} mt={'-2'}><Em> The product category to discount</Em></Text>
                            <Select.Root
                              size="2"
                              value={discountProduct}
                              onValueChange={(value) => {
                                setDiscountProduct(value as "open play" | "reservation" | "pro shop");
                              }}
                            >
                              <Select.Trigger />
                              <Select.Content>
                                <Select.Item value="reservation">Court reservation</Select.Item>
                                <Select.Item value="open play">Open Play</Select.Item>
                                <Select.Item value="pro shop">Pro shop</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </Flex>

                          {discountProduct === 'pro shop' && discountType === 'dollars' ? (
                            <Flex direction="column" gap="5">
                              <Flex direction="column" gap="2">
                                <Text size="3">Minimum spend (optional)</Text>
                                <Text size="1" mt="-2">
                                  <Em>The minimum amount the customer must spend to qualify for this discount.</Em>
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="Minimum spend"
                                  value={minimumSpendAmount ?? ''}
                                  style={{ flexGrow: '1' }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const numeric = Number(value);
                                    setMinimumSpendAmount(value === '' || isNaN(numeric) ? null : numeric);
                                  }}
                                >
                                    <TextField.Slot>
                                      <Text weight="bold">$</Text>
                                    </TextField.Slot>
                                  </TextField.Root>
                                </Flex>
                              </Flex>
                            ) : discountProduct === 'pro shop' && discountType === 'percent' ? (
                              <Flex direction="column" gap="2">
                                <Text size="3">Maximum discount (optional)</Text>
                                <Text size="1" mt="-2">
                                  <Em>The max dollar amount that can be discounted from the purchase.</Em>
                                </Text>
                                <TextField.Root
                                  type="number"
                                  placeholder="Maximum discount"
                                  value={maxDiscountAmount ?? ''}
                                  style={{ flexGrow: '1' }}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const numeric = Number(value);
                                    setMaxDiscountAmount(value === '' || isNaN(numeric) ? null : numeric);
                                  }}
                                >
                                  <TextField.Slot>
                                    <Text weight="bold">$</Text>
                                  </TextField.Slot>
                                </TextField.Root>
                              </Flex>
                            ) : null}
                          
                          <Flex direction={'column'} maxWidth={'300px'}>
                            <Flex direction={'row'} justify={'between'} align={'center'}>
                              <Button
                                size={'2'}
                                loading={isSavingReward}
                                disabled={!discountAmount || !discountType || !discountProduct || !selectedAchievement || !location}
                                onClick={handleSaveReward}
                                style={{width: '100px'}}
                              >
                                Save
                              </Button>
                              {isSelectedAchievementConfigured && (
                                <AlertDialog.Root>
                                  <AlertDialog.Trigger>
                                    <Button
                                      loading={isRemovingReward}
                                      variant="ghost"
                                      color="red"
                                    >
                                      Remove Reward
                                    </Button>
                                  </AlertDialog.Trigger>
                                  <AlertDialog.Content maxWidth="450px">
                                    <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                                    <AlertDialog.Description>
                                      Please confirm you no longer want this reward to be earned. 
                                      Any player who has already earned it will still be able to redeem.
                                    </AlertDialog.Description>

                                    <Flex gap="4" mt="4" justify="end" align={'center'}>
                                      <AlertDialog.Cancel>
                                        <Button variant="soft" color="gray">
                                          Cancel
                                        </Button>
                                      </AlertDialog.Cancel>
                                      <AlertDialog.Action>
                                        <Button
                                        size={'2'}
                                        color="red"
                                        disabled={!selectedAchievement}
                                        onClick={handleRemoveReward}
                                      >
                                        Remove reward
                                      </Button>
                                      </AlertDialog.Action>
                                    </Flex>
                                  </AlertDialog.Content>
                                </AlertDialog.Root>
                              )}
                            </Flex>

                            {rewardSuccess && (
                              <Text mt={'3'} size={'2'} color="green">
                                Reward successfully updated
                              </Text>
                            )}
                            {rewardError && (
                              <Text mt={'3'} size={'2'} color="red">
                                There was an error saving the reward. We&apos;re investigating.
                              </Text>
                            )}
                          </Flex>

                          <Flex direction={'row'} gap={'2'}>
                            <Text size={'3'}>Create a custom reward</Text>
                            <Link href={'mailto:manuel@ggpickleball.co'} target="blank" style={{color: 'blue', textDecoration: 'underline'}}>Contact us</Link>
                          </Flex>
                        </Flex>
                      </Flex>
                    ) : (
                      <Text size="2" color="gray">
                        Click an achievement to set a reward.
                      </Text>
                    )}
                  </Flex>
                )}
                
              </Flex>
            </Flex>
          </Flex>
        )}
      </Flex>
      {isMobile && selectedAchievement && (
        <MobileConfigureRewardsForm
          open={isMobileRewardOpen}
          onOpenChange={setIsMobileRewardOpen}
          selectedAchievement={selectedAchievement}
          discountAmount={discountAmount}
          discountType={discountType}
          discountProduct={discountProduct}
          maxDiscount={maxDiscountAmount}
          minimumSpend={minimumSpendAmount}
          isSavingReward={isSavingReward}
          isRemovingReward={isRemovingReward}
          isConfigured={isSelectedAchievementConfigured}
          rewardSuccess={rewardSuccess}
          rewardError={rewardError}
          onSetAmount={setDiscountAmount}
          onSetType={setDiscountType}
          onSetProduct={setDiscountProduct}
          onSetMinimumSpend={setMinimumSpendAmount}
          onSetMaxDiscount={setMaxDiscountAmount}
          onSave={handleSaveReward}
          onRemove={handleRemoveReward}
        />
      )}
    </Flex>
  )
}