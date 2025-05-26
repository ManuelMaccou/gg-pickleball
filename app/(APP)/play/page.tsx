'use client'

import { Box, Button, Flex, Text } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import lightGgLogo from '../../../public/logos/gg_logo_white_transparent.png'
import Link from 'next/link';
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

export default function Play() {

  const isMobile = useIsMobile();
  const router = useRouter();
  const { user: auth0User, isLoading } = useAuth0User();
  const { user } = useUserContext(); 
  const userName = user?.name

  const [allClients, setAllClients] = useState<IClient[]>([])
  const [currentClient, setCurrentClient] = useState<IClient | null>(null)
  const [dbUser, setDbUser] = useState<FrontendUser | null>(null)
  const [achievementsVariant, setAchievementsVariant] = useState<'full' | 'preview'>('preview')
  const [rewardsVariant, setRewardsVariant] = useState<'full' | 'preview'>('preview')
   const [showHowToDialog, setShowHowToDialog] = useState<boolean>(false)

  const clientId: string | undefined = currentClient?._id?.toString();

  const rawAchievements = clientId ? dbUser?.stats?.[clientId]?.achievements : [];

  const achievementsRaw: AchievementData[] = Array.isArray(rawAchievements)
    ? rawAchievements
    : Object.values(rawAchievements ?? {});


    const earnedAchievements = useMemo(() => {
      const grouped = new Map<string, { count: number; lastEarned: Date }>();
    
      for (const entry of achievementsRaw) {
        const entryDate = new Date(entry.earnedAt); // ⬅ added here
    
        if (!grouped.has(entry.name)) {
          grouped.set(entry.name, { count: 1, lastEarned: entryDate });
        } else {
          const group = grouped.get(entry.name)!;
          group.count += 1;
          group.lastEarned = entryDate > group.lastEarned ? entryDate : group.lastEarned; // ⬅ updated here
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
      if (!user?.isGuest && !auth0User?.sub) return
  
      try {
        let query = ''
        if (user?.isGuest) {
          query = `?name=${encodeURIComponent(user.name)}`
        } else if (auth0User && auth0User.sub) {
          query = `?auth0Id=${encodeURIComponent(auth0User.sub)}`
        }

        if (!query) return
  
        const res = await fetch(`/api/user${query}`)
        const data = await res.json()
  
        if (!res.ok) {
          console.error('Failed to fetch user:', data.error)
          return
        }
  
        // const frontendUser = toFrontendUser(data.user);
        setDbUser(data.user);
       
      } catch (err) {
        console.error('Error fetching user:', err)
      }
    }
  
    fetchUser()
  }, [user, auth0User])  
  
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
            alt="ggupr dark logo"
            priority
            height={540}
            width={960}
          />
        </Flex>

        {!isLoading && (
          <Flex direction={'column'} justify={'center'}>
            <Text size={'3'} weight={'bold'} align={'right'}>
              {userName ? (
                auth0User 
                  ? (String(userName).includes('@') ? String(userName).split('@')[0] : userName)
                  : `${String(userName).includes('@') ? String(userName).split('@')[0] : userName} (guest)`
              ) : ''}
            </Text>
            <Button
              size={'2'}
              variant="outline"
              mt={'1'}
              hidden={!!auth0User}
              onClick={() => router.push(user?.isGuest ? `/auth/login?screen_hint=signup&returnTo=/play` : `/auth/login?returnTo=/play`)}
            >
              {user?.isGuest ? `Create account` : `Log in`}
            </Button>
          </Flex>
        )}
      </Flex>
      
      <Flex direction={'column'}>
        {/* How To Dialog */}
        <HowToDialog open={showHowToDialog} onOpenChange={setShowHowToDialog}/>

        {/* Select location dropdown */}
        {currentClient && (
          <Flex direction={'row'} justify={'center'} align={'center'} gap={'6'} mx={'4'}>
            {allClients.length > 1 ? (
              <LocationDrawer allClients={allClients} currentClient={currentClient} onLocationChange={setCurrentClient}/>
            ) : (
              <Box position={'relative'} height={'70px'} width={'200px'}>
              <Image
                src={currentClient.logo} 
                alt={currentClient.name || "Location logo"}
                fill
                style={{objectFit: 'contain'}}
              />
            </Box>
            )}
          </Flex>
        )}
       
        <Flex direction={'column'} mt={'7'}>
          <Flex direction={'column'} mx={'9'} mb={'7'}>
            <Link href={`/new${currentClient ? `?location=${currentClient._id}` : ''}`}>
              <Button size={'3'} style={{width: '100%'}}>Log match</Button>
            </Link>
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
            unlockedRewardIds={
              userStatsForClient?.rewards
                ? userStatsForClient.rewards.map(r => r.rewardId.toString())
                : []
            }
            earnedRewards={
              Array.isArray(userStatsForClient?.rewards)
                ? userStatsForClient.rewards.map(r => ({
                    rewardId: r.rewardId.toString(),
                    redeemed: r.redeemed,
                    earnedAt: new Date(r.earnedAt),
                    _id: r._id.toString(),
                  }))
              : []
            }
            variant={rewardsVariant}
            maxCount={rewardsVariant === 'preview' ? 3 : undefined}
          />
        )}

        {/* Match history */}
        {user && currentClient && (
          <Flex direction={'column'} mb={'5'} mt={'9'}>
            <Text size={'6'} weight={'bold'}>Match history</Text>
            <MatchHistory userId={user.id} userName={user.name} locationId={currentClient._id.toString()}/>
          </Flex>
        )}
         
      </Flex>
    </Flex>
  )
}