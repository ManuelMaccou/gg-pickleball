'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flex, Spinner, Text } from '@radix-ui/themes';
import { useGeolocation } from '@/app/hooks/useGeolocation';
import { haversineDistance } from '@/utils/haversineDistance';
import { IClient } from '@/app/types/databaseTypes';
import { logError, logMessage } from '@/lib/sentry/logger';

interface LocationGuardProps {
  location: IClient;
  children: React.ReactNode;
}

interface GeolocationError {
  code: number;
  message: string;
}

function isGeolocationError(error: unknown): error is GeolocationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as GeolocationError).code === 'number' &&
    typeof (error as GeolocationError).message === 'string'
  );
}

// Define the verification states
type VerificationStatus = 'verifying' | 'success' | 'failure';

export default function LocationGuard({ location, children }: LocationGuardProps) {
  const router = useRouter();
  const { getLocation } = useGeolocation();
  const [status, setStatus] = useState<VerificationStatus>('verifying');

  const isDisabled = process.env.NEXT_PUBLIC_DISABLE_LOCATION_GUARD === 'true' && 
                     process.env.NODE_ENV === 'development';
  


  useEffect(() => {
    if (isDisabled) {
      console.warn('📍 LocationGuard is disabled for development testing.');
      // Set status to success to render children, then stop the effect.
      setStatus('success');
      return; // Exit the effect early
    }

    const verifyLocation = async () => {
      // --- 1. VALIDATE CLIENT COORDINATES ---
      const { latitude: clientLat, longitude: clientLng } = location;
      if (typeof clientLat !== 'number' || typeof clientLng !== 'number') {
        console.error("LocationGuard: Invalid coordinates for the provided location.");
        router.replace('/error/location-unavailable'); 
        return;
      }
      const clientCoords = { latitude: clientLat, longitude: clientLng };

      // --- 2. GET USER LOCATION AND HANDLE SPECIFIC ERRORS ---
      try {
        const userPosition = await getLocation();
        const userCoords = {
          latitude: userPosition.coords.latitude,
          longitude: userPosition.coords.longitude,
        };

        const distanceInMeters = haversineDistance(userCoords, clientCoords);

        // --- 3. DISTANCE CHECK ---
        if (distanceInMeters > 200) {
          router.replace('/error/not-close-enough');
        } else {
          setStatus('success');
        }
      } catch (error: unknown) {
        setStatus('failure');
        


        if (isGeolocationError(error)) {
          // Inside this block, TypeScript KNOWS `error` has `code` and `message` properties.
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              logMessage('Geolocation permission denied by user.', {
                component: 'LocationGuard',
                locationName: location.name,
              });
              router.replace('/error/location-denied');
              break;
            
            case 2: // POSITION_UNAVAILABLE
            case 3: // TIMEOUT
            default:
              logError(new Error(error.message || 'Geolocation failed with an unknown error.'), {
                component: 'LocationGuard',
                errorCode: error.code,
                locationName: location.name,
              });
              router.replace('/error/location-unavailable');
              break;
          }
        } else {
          // Handle cases where the error is not a GeolocationError (e.g., a string)
          logError(error, {
            component: 'LocationGuard',
            context: 'An unexpected, non-geolocation error was caught.',
            locationName: location.name,
          });
          router.replace('/error/location-unavailable');
        }
      }
    };

    verifyLocation();
  }, [location, getLocation, router, isDisabled]);

  if (status === 'verifying') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spinner size="3" />
        <Text ml="3">Verifying your location...</Text>
      </Flex>
    );
  }

  if (status === 'success') {
    return <>{children}</>;
  }
  
  // If status is 'failure', the user is being redirected,
  // so we can render null or another loading state to prevent UI flicker.
  return null;
}