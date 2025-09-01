'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { AlertDialog, Badge, Button, Callout, Em, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png'
import { IAchievement, IAchievementCategory, IClient } from "@/app/types/databaseTypes";
import Link from "next/link";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import MobileMenu from "../components/MobileMenu";
import MobileAchievementDetails from "../components/MobileAchievementDetails";

export default function GgPickleballAdminAchievements() {

  const { user } = useUserContext();
  const router = useRouter();
  const isMobile =useIsMobile();

  const userId = user?.id
  const userName = user?.name
  
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);
  const [location, setLocation] = useState<IClient | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);
  const [isGettingAllAchievementCategories, setIsGettingAllAchievementCategories] = useState<boolean>(true);
  const [allAchievementCategories, setAllAchievementCategories] = useState<IAchievementCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IAchievementCategory | null>(null);
  const [rewardConfigStatus, setRewardConfigStatus] = useState<string | null>(null);
  const [achievementCategoriesError, setAchievementCategoriesError] = useState<string | null>(null);
  const [configuredClientAchievements, setConfiguredClientAchievements] = useState<IAchievement[]>([]);
  const [isSettingCategoryAchievements, setIsSettingCategoryAchievements] = useState<boolean>(false);
  const [isRemovingCategoryAchievements, setIsRemovingCategoryAchievements] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Get all achievement categories
  useEffect(() => {
    const getAllAchievementCategories = async () => {
      try {
        const response = await fetch('/api/achievement-category');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch all achievement categories");
        }

        setAllAchievementCategories(data.achievementCategories)
      } catch (error: unknown) {
        console.error("Error fetching all possible achievements:", error);
      
        if (error instanceof Error) {
          setAchievementCategoriesError(error.message);
        } else {
          setAchievementCategoriesError("Unknown error occurred");
        }
      } finally {
        setIsGettingAllAchievementCategories(false);
      }
    };

    getAllAchievementCategories();
  }, [])

  // Get admin data
  useEffect(() => {
    if (!userId) return;
  
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          setAdminError("You don't have permission to access this page.");
          return;
        }

        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch admin data");
        }
  
        setLocation(data.admin.location);
      } catch (error: unknown) {
        console.error("Error fetching admin data:", error);
      
        if (error instanceof Error) {
          setAdminError(error.message);
        } else {
          setAdminError("Unknown error occurred");
        }
      
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
        setRewardConfigStatus(data.rewardConfigStatus);

      } catch (error: unknown) {
        console.error("Error fetching updated client data:", error);
      
        if (error instanceof Error) {
          console.error(error.message);
        } else {
          console.error("Unknown error occurred");
        }
      }
    };

    getClientAchievements();
  }, [location])

  const handleCategoryClick = (category: IAchievementCategory) => {
    setSelectedCategory(category);
    if (isMobile) {
      setIsMobileDetailsOpen(true);
    }
  };

  const handleAddAndRefreshClientAchievements = async (client: IClient) => {
    if (!selectedCategory || !client?._id) return;

    try {
      setIsSettingCategoryAchievements(true)

      const achievementContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';

      // Step 1: Fetch all achievements in this category
      const categoryResponse = await fetch(`/api/achievement/category?id=${selectedCategory._id}`);
      const categoryData = await categoryResponse.json();

      if (!categoryResponse.ok) {
        throw new Error(categoryData.error || "Failed to fetch achievements for selected category");
      }

      const categoryAchievementIds = categoryData.achievements.map((a: IAchievement) => a._id);
      console.log('categoryAchievementIds:', categoryAchievementIds);
      console.log('configured achievements:', configuredClientAchievements);

      // Step 2: Merge with currently configured achievements (deduped)
      const existingIds = configuredClientAchievements.map((a) => a._id.toString());
      const mergedAchievementIds = Array.from(new Set([...existingIds, ...categoryAchievementIds]));

      // Step 3: Send to PATCH /api/client
      const patchResponse = await fetch('/api/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client._id,
          achievements: mergedAchievementIds,
          achievementContext,
        }),
      });

      const patchData = await patchResponse.json();

      if (!patchResponse.ok) {
        throw new Error(patchData.error || "Failed to update client achievements");
      }

      console.log('patch data:', patchData)

      const achievementFieldKey =
        achievementContext === 'alt' ? 'altAchievements' : 'achievements';

        console.log('updated achievements:', patchData.client[achievementFieldKey])

      setConfiguredClientAchievements(patchData.client[achievementFieldKey]);
      console.log('updating client state with:', patchData.client[achievementFieldKey])

    } catch (error: unknown) {
      console.error("Error updating client achievements:", error);
    } finally {
      setIsSettingCategoryAchievements(false)
    }
  };

  const handleRemoveCategoryAchievements = async (client: IClient) => {
    if (!selectedCategory || !client?._id) return;

    setIsRemovingCategoryAchievements(true)

    try {
      const achievementContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';
      const rewardContext = location?.reservationSoftware === 'playbypoint' ? 'alt' : 'default';

      // Get all achievements for this category
      const categoryResponse = await fetch(`/api/achievement/category?id=${selectedCategory._id}`);
      const categoryData = await categoryResponse.json();

      if (!categoryResponse.ok) {
        throw new Error(categoryData.error || "Failed to fetch achievements for selected category");
      }

      const categoryAchievementIds = categoryData.achievements.map((a: IAchievement) => a._id.toString());

      // Filter out the ones we want to remove
      const remainingAchievementIds = configuredClientAchievements
      .map((a) => a._id.toString())
      .filter((id) => !categoryAchievementIds.includes(id));

      // Remove associated 'rewardsPerAchievement'
      const removedAchievements = configuredClientAchievements
      .filter((a) => categoryAchievementIds.includes(a._id.toString()))
      .map((a) => a.name);

      // Send updated list
      const patchResponse = await fetch('/api/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client._id,
          achievements: remainingAchievementIds,
          removeRewardForAchievement: removedAchievements,
          achievementContext,
          rewardContext,
        }),
      });

      const patchData = await patchResponse.json();

      if (!patchResponse.ok) {
        throw new Error(patchData.error || "Failed to update client achievements");
      }

      // Step 3: Get rewardIds that were just removed
      const removedRewardIds: string[] = patchData.removedRewardIds ?? [];

      for (const name of removedAchievements) {
       const rewardId = client.rewardsPerAchievement && client.rewardsPerAchievement[name];
        if (rewardId) {
          removedRewardIds.push(rewardId.toString());
        }
      }

      // Step 4: Remove those rewards
      if (removedRewardIds.length > 0) {
        await fetch('/api/reward/bulk/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rewardIds: removedRewardIds }),
        });
      }

      const achievementFieldKey =
        achievementContext === 'alt' ? 'altAchievements' : 'achievements';

        console.log('updated achievements:', patchData.client[achievementFieldKey])

      setConfiguredClientAchievements(patchData.client[achievementFieldKey]);
    } catch (error) {
      console.error("Error removing category achievements:", error);
    } finally {
      setIsRemovingCategoryAchievements(false)
    }
  };


  // Final loading status
  useEffect(() => {
    if (!isGettingAdmin && !isGettingAllAchievementCategories) {
      setIsLoading(false)
    }
  }, [isGettingAdmin, isGettingAllAchievementCategories])
  
  const isSelectedCategoryActive = selectedCategory
  ? configuredClientAchievements.some(
      (achievement) =>
        achievement.categoryId?.toString() === selectedCategory._id.toString()
    )
  : false;

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin/achievements`)
    }
  })

  if (isMobile === null) {
    return null;
  }

  return (
    <Flex direction={'column'} height={'100vh'}>

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
        <Flex direction={'column'} style={{backgroundColor: location?.bannerColor, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', zIndex: 2}}>
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
      <Flex direction={'column'} height={'100%'} width={'100vw'} maxWidth={'1500px'} overflow={'hidden'} px={'4'} style={{alignSelf: 'center'}}>
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
                    <Link href={'/admin/achievements'} style={{backgroundColor: 'white', borderRadius: '10px'}}>Set achievements</Link>
                  </Flex>
                  <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                    <Link href={'/admin/rewards'}>Configure rewards</Link>
                  </Flex>
                </Flex>
              </Flex>
            )}

            {/* Container */}
            <Flex direction={'column'} py={'4'} width={'100%'}>
              <Heading mx={{initial: '0', md: '6'}} mb={'6'}>Set Achievements</Heading>
              <Flex direction={{initial: 'column', md: 'row'}} height={'100%'} width={'100%'}>

                {/* Possible achievements */}
                <Flex direction={'column'} width={{initial: '100%', md: '50%'}} px={{initial: '0', md: '6'}} overflow={'scroll'} style={{...(isMobile ? {} : { borderRight: '1px solid #d3d3d3' })}}>
                  {achievementCategoriesError ? (
                    <Callout.Root size={'3'} color="red" >
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        {achievementCategoriesError}
                      </Callout.Text>
                    </Callout.Root>
                  ) : isGettingAllAchievementCategories ? (
                    <Spinner size={'3'} style={{color: 'black'}} />
                  ) : (
                    <>
                      <Text size="3" mb="3">
                        Select the achievement categories you would like players to earn.
                      </Text>
                      
                      {allAchievementCategories.map((achievementCategory) => {
                        const isConfigured = configuredClientAchievements.some(
                          (achievement) => achievement.categoryId?.toString() === achievementCategory?._id.toString()
                        );

                        return (
                          <Flex
                            key={achievementCategory._id.toString()}
                            direction="row"
                            justify={'between'}
                            gap="1"
                            onClick={() => handleCategoryClick(achievementCategory)}
                            style={{
                              cursor: 'pointer',
                              border: '1px solid #e0e0e0',
                              padding: '0.75rem',
                              marginBottom: '0.5rem',
                              borderRadius: '6px',
                              background: selectedCategory?._id.toString() === achievementCategory._id.toString() ? '#e6f7ff' : '#fafafa',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            <Text weight="bold">
                              {achievementCategory.name.charAt(0).toUpperCase() + achievementCategory.name.slice(1)}
                            </Text>
                            {isConfigured && (
                              <Badge color="green">
                                Activated
                              </Badge>
                            )}
                          </Flex>
                        );
                      })}
                    </>
                  )}
                </Flex>

                {/* Achievement details */}
                {!isMobile && (
                  <Flex direction="column" width="50%" px="6" gap={'3'}>
                    <Text size="3">
                      Achievement details
                    </Text>

                    {selectedCategory && location ? (
                      <>
                        <Flex direction={'column'} mb={'4'}>
                          <Text size="4" weight="bold">
                            {selectedCategory.name.charAt(0).toUpperCase() + selectedCategory.name.slice(1)}
                          </Text>
                          <Text size="3">
                            {selectedCategory.description}
                          </Text>
                        </Flex>
                        <Flex direction={'column'} gap={'3'}>
                          {selectedCategory && selectedCategory.milestones && selectedCategory.milestones?.length > 0 && (
                            <Flex direction={'column'}>
                              <Text size="3" weight={'bold'}>
                                Available milestones
                              </Text>
                              <Text size={'1'}><Em>Not every milestone has to be rewarded</Em></Text>
                              <Flex gap="2" wrap="wrap" m={'4'}>
                                {selectedCategory.milestones.map((milestone, index) => (
                                  <Badge key={index} size="3" color="green">
                                    {milestone}
                                  </Badge>
                                ))}
                              </Flex>
                            </Flex>
                          )}
                            

                          <Flex direction={'column'} width={'200px'} mt={'4'}>
                            {isSelectedCategoryActive ? (
                              <AlertDialog.Root>
                                <AlertDialog.Trigger>
                                  <Button
                                    variant="soft"
                                    color="red"
                                    loading={isRemovingCategoryAchievements}
                                  >
                                    Deactivate
                                  </Button>
                                </AlertDialog.Trigger>
                                <AlertDialog.Content maxWidth="450px">
                                  <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                                  <AlertDialog.Description>
                                    All achievements within this category, and their associated rewards, 
                                    will no longer be able to be earned. Any player who has already earned 
                                    a reward will still be able to redeem.
                                  </AlertDialog.Description>
                                  <Flex gap="4" mt="4" justify="end">
                                    <AlertDialog.Cancel>
                                      <Button variant="soft" color="gray">
                                        Cancel
                                      </Button>
                                    </AlertDialog.Cancel>
                                    <AlertDialog.Action>
                                      <Button
                                        color="red"
                                        disabled={!location}
                                        onClick={() => handleRemoveCategoryAchievements(location)}
                                      >
                                        Deactivate
                                      </Button>
                                    </AlertDialog.Action>
                                  </Flex>
                                </AlertDialog.Content>
                              </AlertDialog.Root>




                            ) : (
                              <Button
                                disabled={!location}
                                loading={isSettingCategoryAchievements}
                                onClick={() => handleAddAndRefreshClientAchievements(location)}>
                                Activate
                              </Button>
                            )}
                          </Flex>

                        </Flex>
                      </>
                    ) : (
                      <Text size="2" color="gray">
                        Click an achievement to see its details.
                      </Text>
                    )}
                  </Flex>
                )}
              </Flex>
            </Flex>
          </Flex>
        )}
      </Flex>

      {isMobile && selectedCategory && location && (
        <MobileAchievementDetails
          open={isMobileDetailsOpen}
          onOpenChange={setIsMobileDetailsOpen}
          selectedCategory={selectedCategory}
          isSelectedCategoryActive={isSelectedCategoryActive}
          isSettingCategoryAchievements={isSettingCategoryAchievements}
          isRemovingCategoryAchievements={isRemovingCategoryAchievements}
          location={location}
          onActivate={() => handleAddAndRefreshClientAchievements(location)}
          onDeactivate={() => handleRemoveCategoryAchievements(location)}
        />
      )}
    </Flex>
  )
}