'use client'

import { useState, useCallback, useRef } from 'react';

export type GeolocationErrorState = { code: number; message: string; } | null;

interface GeolocationState {
  isLoading: boolean;
  position: GeolocationPosition | null;
  error: GeolocationErrorState;
}

/**
 * A hook to get the user's current geolocation with a failsafe timeout.
 * @returns An object with isLoading, position, error, and a function to get the location.
 */
export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    isLoading: false,
    position: null,
    error: null,
  });
  
  // Use a ref to track if the request is in flight to prevent race conditions
  const requestInFlight = useRef(false);

  const getLocation = useCallback(() => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (requestInFlight.current) {
        // Prevent multiple simultaneous requests
        return reject({ code: 100, message: 'A geolocation request is already in progress.' });
      }
      
      if (!navigator.geolocation) {
        const error = { code: 99, message: 'Geolocation is not supported by your browser.' };
        setState(prev => ({ ...prev, error, isLoading: false }));
        return reject(error);
      }
      
      requestInFlight.current = true;
      setState({ isLoading: true, position: null, error: null });

      // --- THE FAILSAFE TIMEOUT ---
      // This will run after 12 seconds if nothing else has happened.
      const timeoutId = setTimeout(() => {
        const error = { code: 3, message: 'Geolocation request timed out.' }; // Code 3 is POSITION_UNAVAILABLE
        setState({ isLoading: false, position: null, error });
        requestInFlight.current = false;
        reject(error);
      }, 12000); // 12 seconds, slightly longer than the internal timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId); // Success! Cancel our failsafe.
          setState({ isLoading: false, position, error: null });
          requestInFlight.current = false;
          resolve(position);
        },
        (error) => {
          clearTimeout(timeoutId); // The browser's error fired, cancel our failsafe.
          const errorState = { code: error.code, message: error.message };
          setState({ isLoading: false, position: null, error: errorState });
          requestInFlight.current = false;
          reject(errorState);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { ...state, getLocation };
};