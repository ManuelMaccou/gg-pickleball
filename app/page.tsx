'use client'

import { useMediaQuery } from 'react-responsive';
import { Box, Button, ChevronDownIcon, Flex, Text } from "@radix-ui/themes";
import Image from "next/image";
import lightGguprLogo from '../public/logos/ggupr_logo_white_transparent.png'
import Link from 'next/link';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from './contexts/UserContext';
import { useEffect, useState } from 'react';
import AchievementsGrid from '@/components/sections/AchievementsGrid';
import { IClient, IUser } from './types/databaseTypes';
import RewardsGrid from '@/components/sections/RewardsGrid';

export default function Ggupr() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const { user: auth0User, isLoading } = useAuth0User();
  const { user } = useUserContext(); 
  const userName = user?.name

  const [isClient, setIsClient] = useState(false);
  const [allClients, setAllClients] = useState<IClient[]>([])
  const [primaryClient, setPrimaryClient] = useState<IClient | null>(null)
  const [currentClient, setCurrentClient] = useState<IClient | null>(null)
  const [dbUser, setDbUser] = useState<IUser | null>(null)
  const [achievementsVariant, setAchievementsVariant] = useState<'full' | 'preview'>('preview')
  const [rewardsVariant, setRewardsVariant] = useState<'full' | 'preview'>('preview')

  type EarnedAchievement = {
    name: string
    count?: number
    earnedAt: Date[]
  }

  type AchievementDetails = {
    count?: number
    earnedAt: Date[]
  }

  useEffect(() => {
    setIsClient(true);
  }, []);

  const clientId = currentClient?._id?.toString();

  const earnedAchievements: EarnedAchievement[] = Object.entries(
    dbUser?.stats?.[currentClient?._id.toString() || '']?.achievements || {}
  ).map(([name, details]: [string, AchievementDetails]) => ({
    name,
    count: details.count,
    earnedAt: details.earnedAt,
  }));

  const handleAchievementsVariantChange = () => {
    setAchievementsVariant((prev) => (prev === 'preview' ? 'full' : 'preview'))
  }

  const handleRewardsVariantChange = () => {
    setRewardsVariant((prev) => (prev === 'preview' ? 'full' : 'preview'))
  }

  // Fetch all clients
  useEffect(() => {
    const fetchAchievements = async () => {
      const res = await fetch('/api/client')
      const data = await res.json()
      setAllClients(data.clients || [])
    }

    fetchAchievements()
  }, [])

  // Fetch user details
  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return
  
      try {
        let query = ''
        if (user.isGuest) {
          query = `?name=${encodeURIComponent(user.name)}`
        } else if (auth0User?.sub) {
          query = `?auth0Id=${encodeURIComponent(auth0User.sub)}`
        }
  
        const res = await fetch(`/api/user${query}`)
        const data = await res.json()
  
        if (!res.ok) {
          console.error('Failed to fetch user:', data.error)
          return
        }
  
        setDbUser(data.user)
        setPrimaryClient(data.user.lastLocation)
      } catch (err) {
        console.error('Error fetching user:', err)
      }
    }
  
    fetchUser()
  }, [user, auth0User])

  // Set current client
  useEffect(() => {
    if (primaryClient) {
      setCurrentClient(primaryClient)
    } else if (allClients.length === 1) {
      setCurrentClient(allClients[0])
    }
  }, [primaryClient, allClients])

  //* set the current client when the user selects a new client from the drawer when there are multiple clients available
  
  if (!isClient) return null;

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'}>
        <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
          <Image
            src={lightGguprLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
            style={{
              width: 'auto',
              maxHeight: '170px',
            }}
          />
          <Text mt={'4'} size={'5'} weight={'bold'}>DUPR for recreational players</Text>
          <Text size={'5'} weight={'bold'}>A GG Pickleball experiment</Text>
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
        <Flex direction={'column'} position={'relative'} maxWidth={'120px'}>
          <Image
            src={lightGguprLogo}
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
          </Flex>
        )}
      </Flex>
      
      <Flex direction={'column'}>
      {allClients.length > 1 ? (
        <Flex direction={'row'} justify={'between'} align={'center'} mx={'4'}>
          <Box position={'relative'} height={'70px'} width={'200px'}>
            <Image
              src={primaryClient?.logo || allClients[0]?.logo} 
              alt={primaryClient?.name || allClients[0]?.name || "Location logo"}
              fill
              style={{objectFit: 'contain'}}
            />
          </Box>
          <ChevronDownIcon height={'20px'} width={'20px'} />
        </Flex>
         ) : allClients.length === 1 ? (
          <Box position={'relative'} height={'70px'} width={'200px'} style={{alignSelf: 'center'}}>
          <Image
            src={primaryClient?.logo || allClients[0]?.logo}
            alt={primaryClient?.name || allClients[0]?.name || "Location logo"}
            fill
            style={{objectFit: 'contain'}}
          />
        </Box>
         ) : null}
       
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

          {dbUser && currentClient && (
            <AchievementsGrid
              earnedAchievements={earnedAchievements}
              variant={achievementsVariant}
              maxCount={achievementsVariant === 'preview' ? 3 : undefined}
            />
          )}
          
        </Flex>
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
        <RewardsGrid
          unlockedRewardIds={
            clientId && dbUser?.stats?.[clientId]?.rewards
              ? Object.keys(dbUser.stats[clientId].rewards)
              : []
          }
          variant={rewardsVariant}
          maxCount={rewardsVariant === 'preview' ? 3 : undefined}
        />
      </Flex>
    </Flex>
  )
}