'use client'

import { useUser } from "@auth0/nextjs-auth0"
import Cookies from "js-cookie";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import Image from "next/image";
import lightGGLogo from '../../public/gg_logo_white_transparent.png'
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { IRegion, ISeason, ITeam, IUser } from "../types/databaseTypes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ApiErrorResponse } from "../types/functionTypes";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterPage() {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [referrer, setReferrer] = useState<string | null>(null);

  useEffect(() => {
    const referrerParam = searchParams.get("referrer");
    if (referrerParam) {
      setReferrer(referrerParam);
    } else {
      const storedReferrer = Cookies.get("referrer");
      if (storedReferrer) {
        setReferrer(storedReferrer);
      }
    }
  }, [searchParams]);

  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [currentTeam, setCurrentTeam] = useState<ITeam | null>(null);

  const [activeSeason, setActiveSeason] = useState<ISeason | null>(null);
  const [region, setRegion] = useState<IRegion | null>(null);

  const [apiError, setApiError] = useState<string | null>(null);
  const [seasonError, setSeasonError] = useState<boolean>(false);
  const [regionError, setRegionError] = useState<boolean>(false);

  const [teammateIsRegistering, setTeammateIsRegistering] = useState<boolean>(false);
  const [userIsRegistered, setUserIsRegistered] = useState<boolean>(false);
  const [paymentNeeded, setPaymentNeeded] = useState<boolean>(false);
  const [continueToLeague, setContinueToLeague] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser || !activeSeason) return;
    
    const fetchCurrentTeam = async() => {
      try {
        const getCurrentTeam = await fetch(
          `/api/teams/findByUserAndSeason?userId=${currentUser._id}&seasonId=${activeSeason._id}`
        );
  
        if (!getCurrentTeam.ok) {
          throw new Error(`Failed to fetch team: ${getCurrentTeam.statusText}`);
        }
  
        const { team }: { team: ITeam | null } = await getCurrentTeam.json();

        if (!team) {
          console.warn('No team found for this user and season.');
          return;
        }

        setCurrentTeam(team);
        console.log('Fetched team:', team);

        const isCaptain = team.captain === currentUser._id;
        const isTeammate = !isCaptain;

        if (team.status === 'PAID') {
          // Special case when team is paid, but the teammate is not registered
          if (team.registrationStep === 'TEAMMATE_INVITED' && isTeammate) {
            setUserIsRegistered(false);
            setPaymentNeeded(false);
            setTeammateIsRegistering(true);
          } else {
            // Team is paid and everything is fine
            setUserIsRegistered(true);
            setPaymentNeeded(false);
            setTeammateIsRegistering(false);
            setContinueToLeague(true);
          }
          return;
        }

        if (isTeammate && team.registrationStep === 'TEAMMATE_INVITED') {
          setTeammateIsRegistering(true);
        }

        const shouldSetPaymentNeeded =
        team.registrationStep === 'TEAMMATE_REGISTERED' ||
        (isCaptain &&
          (team.registrationStep === 'TEAMMATE_INVITED' ||
            team.registrationStep === 'TEAMMATE_REGISTERED'));

        if (shouldSetPaymentNeeded) {
          setPaymentNeeded(true);
          setUserIsRegistered(true);
        }
      } catch (error) {
        console.error('Error fetching team:', error);
      }
    }
    fetchCurrentTeam();
    
  }, [currentUser, activeSeason])


  // Check your db if the user exists. If not, create it.
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (isLoading) return;
    if (!user) {
      router.push('/auth/login?returnTo=/register')
    }
    if (!activeSeason) return

    const checkAndCreateUser = async() => {
      if ( user && user.email) {
        try {
          const userPayload: IUser = {
            name: user.name,
            email: user.email,
            profilePicture: user.picture,
            auth0Id: user.sub,
            activeSeasons:  activeSeason ? [activeSeason] : undefined,
            referrer: referrer ? referrer : undefined,
          };
    
          const userResponse = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userPayload),
          });

          // Couldn't find user. Log out and recreate account.
          if (!userResponse.ok) {
            const errorData: ApiErrorResponse = await userResponse.json()
            setApiError(`An error has occured. Please try logging in again. Redirecting now...`)
          
            console.error(`Failed to create user: ${errorData.systemMessage}`)
          
            setTimeout(() => {
              router.push(
                `/auth/logout?returnTo=${encodeURIComponent(`${baseUrl}/register`)}`
              )
            }, 3000)
            return;
          }

          // User exists. Don't do anything..
          const existingUser = await userResponse.json();
          setCurrentUser(existingUser.user);

          if (existingUser.exists) return;

          // If user was created, send them an email verification email.
          const emailVerificationResponse = await fetch('/api/auth0/email-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, userId: user.sub }),
          })
          
          if (!emailVerificationResponse.ok) {
            const errorData = await emailVerificationResponse.json()
            console.error(errorData.error.message || `Failed to create email verification link for Auth0 user: ${user.sub}`)
          }
        
        } catch (error) {
          console.error("Error creating user:", error);
        }
      }
    };
    checkAndCreateUser();
  }, [activeSeason, isLoading, referrer, router, user])


  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const response = await fetch('/api/seasons/active');

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          setApiError(errorData.userMessage);
          setSeasonError(true);
          throw new Error(`API Error: ${errorData.systemMessage}`);
        }

        const seasonData: ISeason = await response.json();
        setActiveSeason(seasonData);
      } catch (error) {
        console.error('Error fetching active season:', error);
        setApiError((prev) => prev || "An unexpected error happened. Please try again. Code 428.");
      }
    };

    fetchSeason();
  }, []);

  useEffect(() => {
    const fetchRegion = async () => {
      try {
        const response = await fetch('/api/regions');

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          setApiError(errorData.userMessage);
          setRegionError(true);
          throw new Error(`API Error: ${errorData.systemMessage}`);
        }

        const regionData: IRegion = await response.json();
        setRegion(regionData);
      } catch (error) {
        console.error('Error fetching region:', error);
        setApiError((prev) => prev || "An unexpected error happened. Please try again. Code 429");
      }
    };

    fetchRegion();
  }, []);

  useEffect(() => {
    if (continueToLeague) {
      router.push('/challenge')
    }
  }, [continueToLeague, router])

  if (currentTeam && currentTeam.individual && currentTeam.status === "PAYMENT_READY") {
    router.push(`/register/pay?teamId=${currentTeam._id}`)
  }

  if (!isLoading && !user) {
    router.push('/auth/login')
  }

  return (
    <Flex justify={"center"} direction={'column'} mx={'4'} mt={'9'}>
      <Flex direction={'column'} align={'center'} justify={'center'} gap={'4'}>
        <Text size={'7'} weight={'bold'}>Welcome to</Text>
        <Box>
          <Image
            src={lightGGLogo}
            alt="GG Pickleball dark logo"
            priority
            style={{
              width: 'auto',
              maxHeight: '100px',
            }}
          />
        </Box>
          {!teammateIsRegistering && !userIsRegistered ? (
            <Box>
              <Flex mt={'9'} gap={'6'} direction={'column'}>
              <Link
                href={`/register/team?seasonId=${activeSeason?._id}&regionId=${region?._id}`}
                style={{ textDecoration: 'none' }}
              >
                <Button size="4" disabled={!activeSeason || !region} loading={!activeSeason || !region} style={{ width: '100%' }}>
                  Register your team
                </Button>
              </Link>
              <Link
                href={`/register/individual?seasonId=${activeSeason?._id}&regionId=${region?._id}`}
                style={{ textDecoration: 'none' }}
              >
                <Button size="4" disabled={!activeSeason || !region} loading={!activeSeason || !region} style={{ width: '100%' }}>
                  Register as an individual
                </Button>
              </Link>
            </Flex>
          </Box>
            
          ) : teammateIsRegistering && !userIsRegistered && (
            <Box>
              <Flex mt={'9'} gap={'6'} direction={'column'} maxWidth={'500px'}>
                <Text size={'5'} align={'center'}>
                  Your partner has signed you up for the first season of GG Pickleball. Exciting! Continue to complete your registration.
                </Text>
                <Link
                  href={`/register/team?seasonId=${activeSeason?._id}&regionId=${region?._id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Button size="4" disabled={!activeSeason || !region} loading={!activeSeason || !region} style={{ width: '100%' }}>
                    Continue
                  </Button>
                </Link>
              </Flex>
            </Box>
          )}

          {userIsRegistered && !continueToLeague && (
            <Box>
              <Flex mt={'9'} gap={'6'} direction={'column'} maxWidth={'600px'}>
                <Text size={'5'}>
                  You are successfully registered. Keep a look out for the welcome email with more information.
                  Be sure to add play@ggpickleball.co to your email contacts so we don&apos;t end up in your spam folder.
                </Text>
              </Flex>
            </Box>
          )}

          {userIsRegistered && paymentNeeded && currentTeam && (
            <>
            <Box>
              <Flex gap={'6'} direction={'column'} maxWidth={'600px'}>
                <Text size={'5'}>
                    We haven&apos;t received payment yet. Please complete payment for your team before the start of the season.
                    If you believe you or your teammate have already paid, please contact us
                    at <a href="mailto:play@ggpickleball.co">play@ggpickleball.co</a>
                  </Text>
                  <Button size={'4'} asChild>
                    <Link href={`/register/pay?teamId=${currentTeam?._id}`}>
                      <Text size={'4'}>Continue to payment</Text>
                    </Link>
                  </Button>
                </Flex>
              </Box>
            </>
          )}
        </Flex>

      {apiError && (
        <Box m={'4'}>
           <Alert variant="destructive" style={{backgroundColor: "white"}}>
            <AlertCircle/>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {apiError}
            </AlertDescription>
          </Alert>
        </Box>
      )}

      {seasonError || regionError && (
        <Box m={'4'}>
           <Alert variant="destructive" style={{backgroundColor: "white"}}>
            <AlertCircle/>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              There was an error loading season data. Please refresh the page.
            </AlertDescription>
          </Alert>
        </Box>
      )}

    </Flex>
  )
}

export default function Register() {
  return (
    <Suspense>
      <RegisterPage />
    </Suspense>
  )
}