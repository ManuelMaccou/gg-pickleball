'use client'

import { v4 as uuidv4 } from 'uuid';
import { Badge, Button, Flex, Text, TextField } from "@radix-ui/themes";
import Image from "next/image";
import lightGgLogo from '../../../public/logos/gg_logo_white_transparent.png'
import { Suspense, useEffect, useState, useTransition } from "react";
import QRCodeGenerator from '@/app/components/QrCodeGenerator';
import { useRouter, useSearchParams } from "next/navigation";
import { useUserContext } from '@/app/contexts/UserContext';
import { IClient } from '@/app/types/databaseTypes';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/app/hooks/useIsMobile';

function NewMatchPage() {

  const isMobile = useIsMobile();

  const router = useRouter();
  const searchParams = useSearchParams()

  const { user, setUser } = useUserContext()
  const locationParam = searchParams.get('location')

  const [matchId, setMatchId] = useState<string | null>(null);
  const [submittingName, setSubmittingName] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<IClient | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null);

  // set selected location
  useEffect(() => {
    const fetchClientById = async () => {
      const response = await fetch(`/api/client?id=${locationParam}`)
      if (response.ok) {
        const { client }: { client: IClient } = await response.json()
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

if (isMobile === null) {
  return null;
}

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'} pb={'9'}>
        <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
          <Image
            src={lightGgLogo}
            alt="GG Pickleball dark logo"
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
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'} pb={'9'}>
        <Flex position={'relative'} justify={'center'} align={'center'} height={'100px'}>
          {selectedLocation && (
            <Image
              src={selectedLocation.logo}
              alt="Location logo"
              priority
              fill
              style={{objectFit: 'contain'}}
            />
          )}
        </Flex>

        {locationError && (
          <Badge color="red" size={'3'}>
            <Text align={'center'} wrap={'wrap'}>{locationError}</Text>
          </Badge>
        )}
      
        {matchId && user ? (
          <Flex direction={'column'} mx={'9'}>
            {selectedLocation && (
              <>
                <Flex direction={'column'} align={'center'} gap={'4'}>
                  <Flex direction={'column'} mt={'4'} align={'center'}>
                    <Text size={'4'} align={'center'}>All players must scan the same QR code. Once scanned, click continue.</Text>
                  </Flex>
                  <QRCodeGenerator matchId={matchId} selectedLocation={selectedLocation._id.toString()} />
                </Flex>

                
              </>
            )}
            <Flex direction={'column'} mt={'9'} gap={'7'}>
              <Button size={'3'}
                disabled={!selectedLocation || isPending}
                loading={isPending}
                onClick={handleContinue}
              >
               Continue
              </Button>
              <Button variant='ghost'
                size={'3'}
                onClick={() => router.back()}
                style={{ outline: "none", boxShadow: "none" }}
              >
                <ArrowLeft />Go back
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

export default function NewMatch() {
  return (
    <Suspense>
      <NewMatchPage />
    </Suspense>
  )
}
