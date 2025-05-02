'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LocationHelpDialog } from '../components/LocationHelpDialog';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '../contexts/UserContext';
import { IClient } from '../types/databaseTypes';
import { Badge, Box, Button, Flex, Progress, Spinner, Text, TextField } from '@radix-ui/themes';
import Image from 'next/image';
import lightGgLogo from '../../public/logos/gg_logo_white_transparent.png'
import Link from 'next/link';

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  const locationId = searchParams.get('location');
  const router = useRouter();
  const pathname = usePathname();
  const { user: auth0User, isLoading } = useAuth0User();
  const { user, setUser } = useUserContext(); 
  const userName = user?.name;

  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingUserIn, setCheckingUserIn] = useState<boolean>(true);
  const [success, setSuccess] = useState(false);
  const [achievementKey, setAchievementKey] = useState<string | null>(null);
  const [achievementBadge, setAchievementBadge] = useState<string | null>(null);
  const [checkinCount, setCheckinCount] = useState<number | null>(null);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<IClient | null>(null);
  const [submittingName, setSubmittingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>('');

  // Get location
  useEffect(() => {
    setFetchingLocation(true)
    const fetchClientById = async () => {
      const response = await fetch(`/api/client?id=${locationId}`)
      if (response.ok) {
        const { client }: { client: IClient } = await response.json()
        setCurrentLocation(client);
      } else {
        setLocationError("There was an error loading the court location. We've logged the error. Please try again later.");
      }
    }
    setFetchingLocation(false)
    if (locationId) {
      fetchClientById();
    }
  }, [locationId])

  // Get location and check in only if user is set
  useEffect(() => {
    if (!locationId || !user) return;

    const geoSettings = {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 10000,
    };

    const checkPermissionAndCheckin = async () => {
      if (!('geolocation' in navigator)) {
        setError('Geolocation not available in this browser.');
        return;
      }

      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

        if (permissionStatus.state === 'granted') {
          getAndSendLocation();
        } else if (permissionStatus.state === 'prompt') {
          navigator.geolocation.getCurrentPosition(
            () => getAndSendLocation(),
            () => {
              console.error('Location permission denied.');
              setShowLocationHelp(true);
              setError('Location access required to check in.');
            },
            geoSettings
          );
        } else if (permissionStatus.state === 'denied') {
          setShowLocationHelp(true);
          setError('Location access required to check in.');
        }

        permissionStatus.onchange = () => {
          console.log('Permission changed:', permissionStatus.state);
        };
      } catch (error) {
        console.error('Permissions API error:', error);
        setError('Unable to verify location permissions.');
      }
    };

    const fetchAchievementDetails = async (key: string) => {
      try {
        const res = await fetch(`/api/achievement?name=${encodeURIComponent(key)}`);
        if (!res.ok) {
          throw new Error('Failed to fetch achievement details');
        }
        const data = await res.json();
        return data.achievement;
      } catch (error) {
        console.error('Error fetching achievement details:', error);
        return null;
      }
    };

    const getAndSendLocation = () => {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await fetch('/api/user/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, locationId, latitude, longitude }),
          });

          const data = await res.json();
          if (res.ok) {
            console.log('Check-in success!', data);
            setAchievementKey(data.achievementKey);
            setCheckinCount(data.checkinCount)
            setSuccess(true);

            if (data.achievementKey) {
              const achievementDetails = await fetchAchievementDetails(data.achievementKey);
              if (achievementDetails) {
                setAchievementBadge(achievementDetails.badge);
              }
            }

          } else {
            if (res.status === 403) {
              console.error('Check-in failed due to distance:', data.error);
              setError("You're too far away from the location to check in.");
            } else {
              console.error('Check-in failed:', data.error);
              setError(data.error ?? 'Unexpected check-in error.');
            }
          }
        } catch (err) {
          console.error('Error during check-in:', err);
          setError('Unexpected error during check-in.');
        } finally {
          setCheckingUserIn(false);
        }
      }, (geoError) => {
        console.error('Geolocation error:', geoError);
        setShowLocationHelp(true);
        setError('Location access required to check in.');
        setCheckingUserIn(false);
      }, geoSettings);
    };

    checkPermissionAndCheckin();
  }, [locationId, router, user]);

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

  useEffect(() => {
    if (success && !achievementKey && !checkingUserIn && checkinCount && checkinCount >= 6) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 3000);
  
      return () => clearTimeout(timer);
    }
  }, [success, achievementKey, checkingUserIn, checkinCount, router]);


  if (fetchingLocation) {
    return (
    <Flex direction={'column'} minHeight={'100dvh'} p={'4'} justify={'center'} align={'center'} gap={'7'}>
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

        <Flex direction={'column'} align={'center'}>
          <Spinner style={{color: "white"}} />
        </Flex>
      </Flex>
    </Flex>
    )
  }

  if (locationError) {
    return (
      <Flex direction={'column'} minHeight={'100dvh'} p={'4'} gap={'7'}>
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
            </Flex>
          )}
        </Flex>

        {locationError && (
          <Badge color="red" size={'3'}>
            <Text size={'4'} align={'center'} wrap={'wrap'}>{locationError}</Text>
          </Badge>
        )}
        <Button mt={'5'} onClick={() => router.push('/')}>Go back</Button>
      </Flex>
    )
  }

  if (!user) {
    return (
      <Flex direction={'column'} minHeight={'100dvh'} p={'4'} gap={'7'}>
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
            </Flex>
          )}
        </Flex>

        <Flex direction={'column'} gap={'7'} mt={'9'}>
          <Flex direction={'column'} align={'center'}>
            {currentLocation && (
              <Flex direction={'row'} justify={'between'} align={'center'} mx={'4'}>
                <Box position={'relative'} height={'100px'} width={'300px'}>
                  <Image
                    src={currentLocation.logo} 
                    alt={currentLocation.name || "Location logo"}
                    fill
                    priority
                    style={{objectFit: 'contain'}}
                  />
                </Box>
              </Flex>
            )}
          </Flex>
          <Flex direction={'column'} gap={'4'} mt={'4'}>
            <TextField.Root 
              size={'3'}
              type="text" 
              value={tempName} 
              onChange={(e) => setTempName(e.target.value)} 
              placeholder="Enter your player name"
            />

            <Button size={'3'} mb={'4'} disabled={submittingName || !tempName} loading={submittingName} onClick={handleNameSubmit}>
              Continue (quick)
            </Button>
            {error && (
              <Badge size={'3'} color='red'>
                <Text size={'4'} wrap={'pretty'}>
                  {error}
                </Text>
              </Badge>
            )}
            <Text align={'center'}>----- or -----</Text>
            <Button size={'3'} variant='outline' onClick={() => router.push(`/auth/login?screen_hint=signup&returnTo=${pathname}`)}>Create account / Log in</Button>
          </Flex>
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
          <Flex direction={'column'} justify={'center'} gap={'4'}>
            <Text size={'3'} weight={'bold'} align={'right'}>
              {user.name ? (
                auth0User 
                  ? (String(user.name).includes('@') ? String(user.name).split('@')[0] : user.name)
                  : `${String(user.name).includes('@') ? String(user.name).split('@')[0] : user.name} (guest)`
              ) : ''}
            </Text>
          </Flex>
        )}
      </Flex>
   
      {error && (
        <Flex direction={'column'} mt={'9'} gap={'7'}>
          <Badge size={'3'} color='red'>
            <Text size={'4'} wrap={'pretty'}>
              {error}
            </Text>
          </Badge>
          <Button size={'3'}>
            Return home
          </Button>
        </Flex>
      )}

      {!error && !success && (
        <Flex direction={'column'} justify={'center'} mt={'9'}>
          <Text size={'7'} align={'center'}>Checking you in...</Text>
          <Flex direction={'column'} align={'center'} mt={'9'}>
            <Spinner style={{color: 'white', height: '30px', width: '30px'}}/>
          </Flex>
        </Flex>
      )}

      {success && (
        <Flex direction={'column'} gap={'7'} mt={'9'}>
          <Text size={'7'} weight={'bold'} align={'center'}>
            You&apos;re checked in!
          </Text>

          <Flex direction={'column'} align={'center'}>
            {achievementKey && achievementBadge && (
              <>
                <Text size={'5'} weight={'bold'}>Achievement Unlocked:</Text>
                <Image 
                  src={achievementBadge} 
                  alt="Achievement badge" 
                  width={500} 
                  height={500}
                  style={{ marginTop: '20px', height: "200px", width: "200px" }}
                />
              </>
            )}

            {typeof checkinCount === 'number' && checkinCount < 5 && (
              <Flex direction="column" gap="4" mt="6" width={'100%'} px={'9'}>
                <Text align={'center'} size={'3'}>{`${checkinCount} of 5 completed`}</Text>
                <Progress size={'3'} value={100 * (checkinCount / 5)} variant="classic" />
                <Text align={'center'} size={'3'}>Check in 5 times to earn your next reward.</Text>
              </Flex>
            )}

            {typeof checkinCount === 'number' && checkinCount >= 6 && !achievementKey && !achievementBadge && !checkingUserIn && (
              <Flex direction={'column'} justify={'center'} align={'center'} gap={'9'}>
                <Text size={'4'}>Redirecting home...</Text>
                <Spinner size={'3'} />
              </Flex>
            )}

            <Flex direction={'column'} mt={'9'} px={'9'} width={'100%'}>
              <Button asChild>
                <Link href={`/${params.toString() ? `?${params.toString()}` : ''}`}>Continue</Link>
              </Button>
            </Flex>
          </Flex>
        </Flex>
      )}


      <LocationHelpDialog open={showLocationHelp} onOpenChange={setShowLocationHelp} />
  </Flex>
  );
}
