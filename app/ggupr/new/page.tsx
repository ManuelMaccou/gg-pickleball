'use client'

import { useMediaQuery } from 'react-responsive';
import { v4 as uuidv4 } from 'uuid';
import { Badge, Button, Flex, Heading, Spinner, Text, TextField } from "@radix-ui/themes";
import Image from "next/image";
import lightGguprLogo from '../../../public/ggupr_logo_white_transparent.png'
import { useEffect, useState } from "react";
import QRCodeGenerator from '../components/QrCodeGenerator';
import Cookies from 'js-cookie';
import { useRouter } from "next/navigation";
import { ApiErrorResponse } from '@/app/types/functionTypes';
import { useUser } from '@auth0/nextjs-auth0';
import LocationSearch from '../components/LocationSearch';

export default function NewMatch() {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  const router = useRouter();
  const { user, isLoading: authIsLoading } = useUser();

  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState<boolean | null>(null);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [submittingName, setSubmittingName] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>('');
  const [userActive, setUserActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameSubmit = async () => {
    setSubmittingName(true);
    if (!tempName.trim()) return;

    try {
      const response = await fetch('/api/ggupr/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName })
      });

      const data = await response.json();

      if (response.ok) {
        Cookies.set('userName', tempName, { sameSite: 'strict' });
        setUserActive(true);
        setError(null);
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      setError('An unexpected error occurred');
    } finally {
      setSubmittingName(false);
    }
  };

  useEffect(() => {
    console.log('selected location:', selectedLocation)
  }, [selectedLocation])

  // Create match ID on page load
  useEffect(() => {
    const newMatchId = uuidv4();
    if (!matchId) setMatchId(newMatchId);

  }, [matchId])

  // Determining guest or authenticated user
  useEffect(() => {
    if (authIsLoading) return;

    if (!user) {
      const storedName = Cookies.get('userName');
      if (storedName) {
        setUserActive(true)
      }
      setIsAuthenticatedUser(false)
    } else {
      setIsAuthenticatedUser(true)
    }
  }, [authIsLoading, user])

/*
  // OLD
  useEffect(() => {   

    const fetchUserAndSaveToGgupr = async () => {
      setIsLoading(true)

      let username: string;

      try {
        const response = await fetch(`/api/users/auth0Id/?auth0Id=${user?.sub}`);

        if (!response.ok) {  
          if (response.status === 404) {
            username = user?.email || '';
          } else {
            const errorData: ApiErrorResponse = await response.json();
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
        } else {
          const fetchedUser = await response.json();
          username = fetchedUser.user.email
        }

        const gguprUserresponse = await fetch(`/api/ggupr/user?auth0Id=${user?.sub}`);

        if (!gguprUserresponse.ok) {
          if (gguprUserresponse.status === 404 ) {
            const gguprResponse = await fetch('/api/ggupr/user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                name: username,
                auth0Id: user?.sub
              })
            });

            if (!gguprResponse.ok) {
              const errorData: ApiErrorResponse = await gguprResponse.json();
              throw new Error(`API Error: ${errorData.systemMessage}`);
            } else {
              const { user: newGguprUser } = await gguprResponse.json()
              Cookies.remove('userName')
              setUserActive(true)
              console.log("saved user:", newGguprUser )
            }
          } else {
            const errorData: ApiErrorResponse = await gguprUserresponse.json();
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
        } else {
          Cookies.remove('userName')
          setUserActive(true);
        }
      } catch (error) {
        console.error('Error fetching and saving current user:', error);
      } finally {
        setIsLoading(false)
      }
    };

    if (!authIsLoading && user) {
      fetchUserAndSaveToGgupr();
    } else {
      const storedName = Cookies.get('userName');
      if (storedName) {
        setUserActive(true);
      }
    }
    
  }, [authIsLoading, user]);
*/

  // NEW
  useEffect(() => {
    setIsLoading(true)

    if (isAuthenticatedUser) {
      if (!authIsLoading && user) {
        const storedName = Cookies.get('userName');
        if (storedName) {
          const addAuth0IdToGguprUser = async () => {
            try {

              const updatedUserResponse = await fetch(`/api/ggupr/user`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  findBy: 'userName',
                  upsertValue: true,
                  userName: storedName,
                  auth0Id: user.sub
                })
              });
      
              if (!updatedUserResponse.ok) {
                throw new Error('Failed to create user from guest account.');
              }
      
              const updatedUser = await updatedUserResponse.json();
             
              if (updatedUser) {
                setUserActive(true);
                Cookies.remove('userName')
                console.log("User updated and cookie removed", updatedUser);
              } else {
                console.warn("No user found for the stored name.");
              }
            } catch (error) {
              console.error("Error fetching user from cookie:", error);
            }
          };
          addAuth0IdToGguprUser()

        } else {
          const fetchGguprUserByAuth0Id = async () => {
           
            try {
              const response = await fetch(`/api/ggupr/user?auth0Id=${user.sub}`);
      
              if (!response.ok) {  
                if (response.status === 404) {
                  const username = user?.email || '';

                  const gguprResponse = await fetch('/api/ggupr/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      name: username,
                      auth0Id: user?.sub
                    })
                  });

                  if (!gguprResponse.ok) {
                    const errorData: ApiErrorResponse = await gguprResponse.json();
                    throw new Error(`API Error: ${errorData.systemMessage}`);
                  }     
                  setUserActive(true);             
                  
                } else {
                  const errorData: ApiErrorResponse = await response.json();
                  throw new Error(`API Error: ${errorData.systemMessage}`);
                }
              } else {
                setUserActive(true);
              }
            } catch (error) {
              console.error("Error fetching user from cookie:", error);
            }
          };
          fetchGguprUserByAuth0Id()
        }
      }
    }
    setIsLoading(false);

  }, [authIsLoading, isAuthenticatedUser, user])

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
      
        {matchId && userActive ? (
          <Flex direction={'column'} mx={'9'}>
             <Flex direction={'column'} align={'center'} gap={'5'} mb={'5'}>
              <LocationSearch selectedLocation={selectedLocation} onLocationSelect={setSelectedLocation} />
              <Button variant='ghost' size={'3'} onClick={() => setSelectedLocation('Other')}>skip</Button>
            </Flex>

          {selectedLocation && (
            <>
              <Flex direction={'column'} align={'center'} gap={'4'}>
                <Heading align={'center'}>Log a new match</Heading>
                <QRCodeGenerator matchId={matchId} selectedLocation={selectedLocation} />
              </Flex>

              <Flex direction={'column'} mt={'4'} align={'center'}>
              <Text>All players must scan the same QR code. Once scanned, click continue.</Text>
              </Flex>
            </>
          )}
            
           
            
            

            <Flex direction={'column'} mt={'9'}>
              <Button size={'3'} disabled={!selectedLocation} onClick={() => router.push(`/ggupr/${matchId}${selectedLocation ? `?location=${selectedLocation}` : ""}`)}>Continue</Button>
            </Flex>
            
    
          </Flex>
          ) : !userActive && !isLoading ? (
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
              <Text align={'center'}>----- or -----</Text>
              <Button size={'3'} variant='outline' onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/ggupr/new')}>Create account / Log in</Button>

              {error && (
                 <Badge size={'3'} color='red'>
                 
                  {error}
            
                  
                 </Badge>
              )}
             
              
            </Flex>
          </Flex>
            
          ) : isLoading ? (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Spinner />
            </Flex>
          ) : null }


       
  
      </Flex>

   
  )
}