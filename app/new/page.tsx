'use client'

import { useMediaQuery } from 'react-responsive';
import { v4 as uuidv4 } from 'uuid';
import { Badge, Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import Image from "next/image";
import lightGguprLogo from '../../public/logos/ggupr_logo_white_transparent.png'
import { useEffect, useState, useTransition } from "react";
import QRCodeGenerator from '../components/QrCodeGenerator';
import { useRouter, useSearchParams } from "next/navigation";
import { useUserContext } from '../contexts/UserContext';
import { IClient } from '../types/databaseTypes';

export default function NewMatch() {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const router = useRouter();
  const searchParams = useSearchParams()

  const { user, setUser } = useUserContext()
  const locationParam = searchParams.get('location')

  const [matchId, setMatchId] = useState<string | null>(null);
  const [submittingName, setSubmittingName] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<IClient | null>(null);
  const [preselectedLocation, setPreselectedLocation] = useState<IClient | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null);

  // set selected location
  useEffect(() => {
    console.log('fetching location')
    const fetchClientById = async () => {
      const response = await fetch(`/api/client?id=${locationParam}`)
      if (response.ok) {
        const { client }: { client: IClient } = await response.json()
        setPreselectedLocation(client);
        setSelectedLocation(client);
      } else {
        setLocationError("There was an error loading the court location. We've logged the error. Please try again later.");
      }
    }

    if (locationParam) {
      fetchClientById();
    }
  }, [locationParam])

  const handleNameSubmit = async () => {
    setSubmittingName(true);
    if (!tempName.trim()) return;

    try {
      const response = await fetch('/api/user/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: tempName })
      });

      const data = await response.json();

      if (response.ok) {

        setUser({
          id: data.user._id,
          name: tempName,
          isGuest: true,
        })
        setError(null);
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      setError('An unexpected error occurred');
    } finally {
      setSubmittingName(false);
      router.refresh()
    }
  };

  // Create match ID on page load
  useEffect(() => {
    const newMatchId = uuidv4();
    if (!matchId) setMatchId(newMatchId);

  }, [matchId])
 
const handleContinue = () => {
  if (!selectedLocation) return

  startTransition(() => {
    const url = `/match/${matchId}?location=${encodeURIComponent(selectedLocation._id.toString())}`
    router.push(url)
  })
}

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'} pb={'9'}>
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
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'} pb={'9'}>
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

          {locationError && (
            <Badge color="red" size={'3'}>
              <Text align={'center'} wrap={'wrap'}>{locationError}</Text>
            </Badge>
          )}
      
        {matchId && user ? (
          <Flex direction={'column'} mx={'9'}>
             <Flex direction={'column'} align={'center'} gap={'5'} mb={'5'}>
              {preselectedLocation && (
                <Text align={'center'} size={'7'} weight={'bold'}>{preselectedLocation.name}</Text>
              )}
            </Flex>

          {selectedLocation && (
            <>
              <Flex direction={'column'} align={'center'} gap={'4'}>
                <Heading align={'center'}>Scan</Heading>
                <QRCodeGenerator matchId={matchId} selectedLocation={selectedLocation.name} />
              </Flex>

              <Flex direction={'column'} mt={'4'} align={'center'}>
              <Text>All players must scan the same QR code. Once scanned, click continue.</Text>
              </Flex>
            </>
          )}
            <Flex direction={'column'} mt={'9'}>
              <Button size={'3'}
                disabled={!selectedLocation || isPending}
                loading={isPending}
                onClick={handleContinue}
              >
               Continue
              </Button>
            </Flex>
            
          </Flex>
          ) : !user ? (
            <Flex direction={'column'} gap={'4'}>
              <TextField.Root 
              size={'3'}
              type="text" 
              value={tempName} 
              onChange={(e) => setTempName(e.target.value)} 
              placeholder="Enter your player name"
            />
            <Flex direction={'column'} mb={'9'} gap={'5'}>
              <Button size={'3'} disabled={submittingName || !tempName} loading={submittingName} onClick={handleNameSubmit}>
                Continue (quick)
              </Button>
              {error && (
                 <Badge size={'3'} color='red'>
                  {error}
                 </Badge>
              )}
              <Text align={'center'}>----- or -----</Text>
              <Button size={'3'} variant='outline' onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/new')}>Create account / Log in</Button>

             
             
            </Flex>
          </Flex>
            
          ) : null }

      </Flex>

   
  )
}