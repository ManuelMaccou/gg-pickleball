'use client'

import { Box, Button, Callout, Flex, Spinner, Text } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import lightGgLogo from '../../../public/logos/gg_logo_white_transparent.png'
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useEffect, useMemo, useState } from 'react';
import AchievementsGrid from '@/components/sections/AchievementsGrid';
import { AchievementData, IClient } from '@/app/types/databaseTypes';
import RewardsGrid from '@/components/sections/RewardsGrid';
import LocationDrawer from '@/app/components/LocationDrawer';
import { FrontendUser } from '@/app/types/frontendTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { Types } from "mongoose";
import MatchHistory from "@/components/sections/MatchHistory";
import { HowToDialog } from "./components/HowToDialog";
import PlayMenu from "@/app/components/PlayMenu";
import { useGeolocation } from "@/app/hooks/useGeolocation";

export default function Play() {

  const isMobile = useIsMobile();
  const router = useRouter();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user: contextUser } = useUserContext(); 

  const [allClients, setAllClients] = useState<IClient[]>([])
  const [currentClient, setCurrentClient] = useState<IClient | null>(null)
  const [dbUser, setDbUser] = useState<FrontendUser | null>(null)
  const [achievementsVariant, setAchievementsVariant] = useState<'full' | 'preview'>('preview')
  const [rewardsVariant, setRewardsVariant] = useState<'full' | 'preview'>('preview')
  const [showHowToDialog, setShowHowToDialog] = useState<boolean>(false)
  const [isFetchingDbUser, setIsFetchingDbUser] = useState(true);
  const { isLoading: isGettingLocation, error: locationError } = useGeolocation();
    
  const authenticationStatus = useMemo(() => {
    if (auth0IsLoading || isFetchingDbUser) {
      return 'loading';
    }
    if (auth0User && dbUser) {
      return 'authenticated';
    }
    if (contextUser?.isGuest && dbUser) {
      return 'guest';
    }
    return 'anonymous';
  }, [auth0IsLoading, isFetchingDbUser, auth0User, dbUser, contextUser]);

  const clientId: string | undefined = currentClient?._id?.toString();

  const rawAchievements = clientId ? dbUser?.stats?.[clientId]?.achievements : [];

  const achievementsRaw: AchievementData[] = Array.isArray(rawAchievements)
    ? rawAchievements
    : Object.values(rawAchievements ?? {});


    const earnedAchievements = useMemo(() => {
      const grouped = new Map<string, { count: number; lastEarned: Date }>();
    
      for (const entry of achievementsRaw) {
        const entryDate = new Date(entry.earnedAt);
    
        if (!grouped.has(entry.name)) {
          grouped.set(entry.name, { count: 1, lastEarned: entryDate });
        } else {
          const group = grouped.get(entry.name)!;
          group.count += 1;
          group.lastEarned = entryDate > group.lastEarned ? entryDate : group.lastEarned;
        }
      }
    
      return Array.from(grouped.entries()).map(([name, { count, lastEarned }]) => ({
        name,
        earnedAt: lastEarned,
        achievementId: new Types.ObjectId(),
        count,
      }));
    }, [achievementsRaw]);
    
    
  useEffect(() => {
    const hasSeenLocally = localStorage.getItem('howto') === 'seen';
    const hasSeenViaStats = dbUser?.stats && Object.keys(dbUser.stats).length > 0;

    if (!hasSeenLocally && !hasSeenViaStats) {
      setShowHowToDialog(true);
    }
  }, [dbUser]);

  const handleAchievementsVariantChange = () => {
    setAchievementsVariant((prev) => (prev === 'preview' ? 'full' : 'preview'))
  }

  const handleRewardsVariantChange = () => {
    setRewardsVariant((prev) => (prev === 'preview' ? 'full' : 'preview'))
  }

  // Fetch all clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch('/api/client')
        if (!res.ok) {
          throw new Error('Failed to fetch clients')
        }
        const data = await res.json()
        
        console.log('all clients:', data.clients)

        setAllClients(data.clients || [])
      } catch (error) {
        console.error('Error fetching clients:', error)
      }
    }

    fetchClients()
  }, [])

  // Set lastLocation cookie
  useEffect(() => {
    if (allClients.length === 0) return

    const setClientFromCookie = async () => {
      try {
        if (allClients.length === 1) {
          setCurrentClient(allClients[0])
          return
        }

        const lastLocationCookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith('lastLocation='))
          ?.split('=')[1]

        if (lastLocationCookie) {
          const lastLocation = allClients.find((client) => client._id.toString() === lastLocationCookie)
          if (lastLocation) {
            setCurrentClient(lastLocation)
          } else {
            console.warn('No matching client found for cookie value.')
          }
        } else {
          document.cookie = `lastLocation=${allClients[0]._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
          setCurrentClient(allClients[0])
        }
      } catch (error) {
        console.error('Error setting client from cookie:', error)
      }
    }

    setClientFromCookie()
  }, [allClients])

  // Fetch user details
  useEffect(() => {
    const fetchUser = async () => {
      // Condition 1: We already have the correct authenticated user.
      if (auth0User && dbUser && dbUser.auth0Id === auth0User.sub) {
        setIsFetchingDbUser(false);
        return;
      }
      // Condition 2: We already have the correct guest user.
      if (contextUser?.isGuest && dbUser && dbUser.name === contextUser.name) {
        setIsFetchingDbUser(false);
        return;
      }
      // Condition 3: We're logged out and there's no guest. Nothing to fetch.
      if (!auth0IsLoading && !auth0User && !contextUser) {
        setIsFetchingDbUser(false);
        setDbUser(null);
        return;
      }
      
      let query = '';
      if (contextUser?.isGuest) {
        query = `?name=${encodeURIComponent(contextUser.name)}`;
      } else if (auth0User?.sub) {
        query = `?auth0Id=${encodeURIComponent(auth0User.sub)}`;
      }

      if (!query) return;

      try {
        setIsFetchingDbUser(true);
        const res = await fetch(`/api/user${query}`);
        const data = await res.json();
        
        if (res.ok) {
          setDbUser(data.user);
        } else {
          console.error('Failed to fetch user:', data.error);
          setDbUser(null);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      } finally {
        setIsFetchingDbUser(false);
      }
    };
  
    fetchUser();
  }, [contextUser, auth0User, auth0IsLoading, dbUser]);

  const handleLogMatchClick = () => {
    if (currentClient?._id) {
      router.push(`/new?location=${currentClient._id}`);
    } else {
      console.error("Cannot log match: No location selected.");
    }
  };

  
  const userStatsForClient = clientId ? dbUser?.stats?.[clientId] : undefined;
  if (userStatsForClient && !Array.isArray(userStatsForClient.rewards)) {
    userStatsForClient.rewards = Object.values(userStatsForClient.rewards ?? {});
  }

  if (isMobile === null) {
    return null;
  }

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'}>
        <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
          <Image
            src={lightGgLogo}
            alt="GG Pickleball logo"
            priority
            height={540}
            width={960}
            style={{
              width: 'auto',
              maxHeight: '170px',
            }}
          />
        </Flex>

        <Flex direction={'column'} justify={'center'} align={'center'}>
          <Text size={'6'} align={'center'}>This app is optimized for mobile devices only.</Text>
        </Flex>
      </Flex>
    )
  }

  return (

    <Flex direction={'column'} minHeight={'100vh'} p={'4'} style={{paddingBottom: '150px'}}>
      <Flex justify={"between"} align={'center'} direction={"row"} pt={"2"} pb={"5"} px={'2'}>
        <Flex direction={'column'} position={'relative'} maxWidth={'80px'}>
          <Image
            src={lightGgLogo}
            alt="GG Pickleball light logo"
            priority
            height={540}
            width={960}
          />
        </Flex>

        {authenticationStatus === 'loading' ? (
          <Spinner />
        ) : (
          <Flex direction={'row'} justify={'center'} align={'center'}>
            {/* Display username if authenticated or guest */}
            {(authenticationStatus === 'authenticated' || authenticationStatus === 'guest') && dbUser && (
              <Text size={'3'} weight={'bold'} align={'right'}>
                {String(dbUser.name).split('@')[0]}
                {authenticationStatus === 'guest' && ' (guest)'}
              </Text>
            )}

            {/* Display login button ONLY if truly anonymous */}
            {authenticationStatus === 'anonymous' && (
              <Button
                size={'2'}
                variant="outline"
                mt={'1'}
                onClick={() => router.push('/auth/login?returnTo=/play')}
              >
                Log in
              </Button>
            )}
            
            {/* The PlayMenu should only render when we have a confirmed user */}
            {(authenticationStatus === 'authenticated' || authenticationStatus === 'guest') && dbUser && (
              <PlayMenu
                isAuthorized={authenticationStatus === 'authenticated'}
                user={dbUser}
                onUserUpdate={setDbUser}
              />
            )}
          </Flex>
        )}
      </Flex>
      
      <Flex direction={'column'}>
        {/* How To Dialog */}
        <HowToDialog open={showHowToDialog} onOpenChange={setShowHowToDialog}/>

        {/* Select location dropdown */}
        {currentClient && (
          <Flex direction="row" justify="center" align="center" gap="6" mx="4">
            {allClients.filter(client =>
              Array.isArray(client.achievements) && client.achievements.length > 0 &&
              client.rewardsPerAchievement && Object.keys(client.rewardsPerAchievement).length > 0
            ).length > 1 ? (
              <LocationDrawer
                allClients={allClients}
                currentClient={currentClient}
                onLocationChange={setCurrentClient}
              />
            ) : (
              <Box position="relative" height="70px" width="200px">
                <Image
                  src={currentClient.logo}
                  alt={currentClient.name || "Location logo"}
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </Box>
            )}
          </Flex>
        )}
              
        <Flex direction={'column'} mt={'7'}>
          <Flex direction={'column'} mx={'9'} mb={'7'}>
            <Button 
              onClick={handleLogMatchClick}
              loading={isGettingLocation}
              disabled={isGettingLocation || !currentClient}
              size={'3'} style={{width: '100%'}}
            >
              Log match
            </Button>
            {locationError && (
              <Callout.Root color="red" mt="2">
                <Callout.Text>{locationError.message}</Callout.Text>
              </Callout.Root>
            )}

          </Flex>
          <Flex direction={'row'} width={'100%'} justify={'between'} mb={'5'}>
            <Text size={'6'} weight={'bold'}>Achievements</Text>
            <Button size={'3'}  color={achievementsVariant === 'preview' ? 'green' : 'amber'}
              variant='soft'
              style={{width: "fit-content"}}
              onClick={handleAchievementsVariantChange}
            >
               {achievementsVariant === 'preview' ? "View all" : "View less"}
            </Button>
          </Flex>

          {/* Acheivements */}
          {currentClient && (
            <AchievementsGrid
              clientId={currentClient._id.toString()}
              earnedAchievements={earnedAchievements}
              variant={achievementsVariant}
              maxCount={achievementsVariant === 'preview' ? 3 : undefined}
            />
          )}
          
        </Flex>

         {/* Rewards */}
        <Flex direction={'row'} width={'100%'} justify={'between'} mb={'5'} mt={'9'}>
          <Text size={'6'} weight={'bold'}>Rewards</Text>
          <Button size={'3'} color={rewardsVariant === 'preview' ? 'green' : 'amber'}
            variant='soft'
            style={{width: "fit-content"}}
            onClick={handleRewardsVariantChange}
          >
            {rewardsVariant === 'preview' ? "View all" : "View less"}
          </Button>
        </Flex>
        {currentClient && (
          <RewardsGrid
            user={dbUser}
            location={currentClient}
            variant={rewardsVariant}
            maxCount={rewardsVariant === 'preview' ? 3 : undefined}
          />
        )}

        {/* Match history */}
        {contextUser && currentClient && (
          <Flex direction={'column'} mb={'5'} mt={'9'}>
            <Text size={'6'} weight={'bold'}>Match history</Text>
            <MatchHistory userId={contextUser.id} userName={contextUser.name} locationId={currentClient._id.toString()}/>
          </Flex>
        )}
         
      </Flex>
    </Flex>
  )
}