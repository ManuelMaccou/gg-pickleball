// http://localhost:3000/register/team/teammate?teammate1=67ae71665833c2dff397bc18&regionId=67aaed654bf05bdbe38ca440&seasonId=67aa859d7852366cccb37379

"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Box, Flex, Heading, Text, VisuallyHidden } from "@radix-ui/themes";
import Image from "next/image";
import lightGGLogo from '../../../../public/gg_logo_white_transparent.png'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import { Suspense, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { ApiErrorResponse } from "@/app/types/functionTypes";
import { ITeam, IUser } from "@/app/types/databaseTypes";

interface FormData {
  fullName: string;
  email: string;
  dupr: number;
  duprUrl?: string;
  dropdownValue?: string;
}

interface Auth0User {
  user_id: string
  email: string
}

interface Auth0ResponseType {
  auth0User: Auth0User
  passwordSetupLink: string
}

function RegisterTeammatePage() {

  const { user } = useUser()
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onBlur",
  });

  const [teammate1Id, setTeammate1Id] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    setIsSubmitting(true);

    try {

      // Check if user with email exists
      const existingUserResponse = await fetch(`/api/users/email?email=${data.email}`);
      const { exists, user: existingUser } = await existingUserResponse.json();

      let teammate2Id;
      
      if (!exists) {

        // Create Auth0 user, generate password reset link, and email registration confirmation to user
        const auth0Response = await fetch('/api/auth0/create-teammate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        })
        
        if (!auth0Response.ok) {
          const errorData = await auth0Response.json()
          setApiError(errorData.error.message || 'Failed to create Auth0 user')
          throw new Error(`Auth0 error: ${errorData.error}`)
        }
        
        const { auth0User, passwordSetupLink }: Auth0ResponseType = await auth0Response.json()
        console.log('Auth0 user created:', auth0User)
        console.log('Password setup link:', passwordSetupLink)


        // Create user in database
        const userPayload = {
          name: data.fullName,
          email: data.email,
          auth0Id: auth0User.user_id,
          firstTimeInvite: true,
          activeSeasons: seasonId ? [seasonId] : undefined,
        };

        const userResponse = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userPayload),
        });
  
        if (!userResponse.ok) {
          const errorData: ApiErrorResponse = await userResponse.json();
          setApiError(errorData.userMessage);
          throw new Error(`Failed to create user: ${errorData.systemMessage}`);
        }
  
        const { user: createdUser } = await userResponse.json();
        teammate2Id = createdUser._id;
        console.log("Teammate 2 created successfully:", createdUser);

      } else {
        teammate2Id = existingUser._id;
        console.log("not creating a new user");
      }

      const teamPayload = {
        teammateId: teammate2Id,
        registrationStep: "TEAMMATE_INVITED",
      };

      const teamResponse = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamPayload),
      });

      if (!teamResponse.ok) {
        const errorData: ApiErrorResponse = await teamResponse.json();
        setApiError(errorData.userMessage);
        throw new Error(`Failed to create team: ${errorData.systemMessage}`);
      }

      const { team } = await teamResponse.json();
      console.log("Team created successfully:", team);
      
      router.push(`/register/pay?teamId=${teamId}`);

    } catch (error) {
      console.error('Registration error:', error);
  
      if (error instanceof Error) {
        console.error('Detailed error:', error.message);
      }
      setApiError((prev) => prev || "An unexpected error happened. Please try again. Code 431.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
      if (typeof window !== 'undefined' && searchParams) {
      const regionIdParam = searchParams.get('regionId');
      const seasonIdParam = searchParams.get('seasonId');
      const teammate1Param = searchParams.get('teammate1');
      const teamIdParam = searchParams.get('teamId');

      if (teammate1Param && regionIdParam && seasonIdParam && teamIdParam) {
       setTeammate1Id(teammate1Param)
       setRegionId(regionIdParam)
       setSeasonId(seasonIdParam)
       setTeamId(teamIdParam)
      } else {
        router.push('/register')
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!user || !seasonId) return;

    const checkProgress = async() => {
      try {
        console.log('Starting access check for user:', user.sub);

        const getCurrentUser = await fetch(`/api/users/auth0Id/?auth0Id=${user.sub}`);
        if (!getCurrentUser.ok) {
          throw new Error(`Failed to fetch user: ${getCurrentUser.statusText}`);
        }

        const { user: currentUser }: { user: IUser } = await getCurrentUser.json();
        if (!currentUser) {
          console.log('current user not found individual success')
          router.push('/register')
          return;
        }
       
        const getCurrentTeam = await fetch(
          `/api/teams/findByUserAndSeason?userId=${currentUser._id}&seasonId=${seasonId}`
        );

        if (!getCurrentTeam.ok) {
          throw new Error(`Failed to fetch team: ${getCurrentTeam.statusText}`);
        }

        const { team }: { team: ITeam } = await getCurrentTeam.json();
        console.log('Fetched team:', team);

        if (!team || (team.registrationStep !== 'CAPTAIN_REGISTERED' && team.registrationStep !== 'TEAMMATE_INVITED')) {
          console.log('Invalid team state, redirecting to /register');
          router.push('/register');
        } else {
          console.log('Access granted!');
        }
      } catch (error) {
        console.error('Access check failed:', error);
        router.push('/register');
      }
    };
    
    checkProgress();

  }, [router, seasonId, user])

  if (!user) return null

  return (
    <Flex minHeight={'100vh'} direction={'column'} mx={'5'} pb={'9'} className="px-[15px] xl:px-[400px]">
      <Box pt={"9"} pb={"5"}>
        <Image
          src={lightGGLogo}
          alt="GG Pickleball dark logo"
          priority
          style={{
            width: 'auto',
            maxHeight: '50px',
          }}
        />
      </Box>
      <Box mb={'5'}>
        <Heading as="h1">Enter your teammate&apos;s information</Heading>
      </Box>

      <Flex direction={'column'} mx={'4'}>
        <Box>
          <form onSubmit={handleSubmit(onSubmit)}>

            {/* Full Name Field */}
            <Flex direction={'column'} gap={'2'} mb={'5'}>
              <Label htmlFor="fullName" className="text-base">Teammate&apos;s Full Name</Label>
              <Input id="fullName" {...register("fullName", { required: "Full Name is required" })}
                style={{
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: '#777777',
                  backgroundColor: '#2b2b2b'
                }}
              />
              {errors.fullName && <Text color="red">{errors.fullName.message}</Text>}
            </Flex>

            {/* Email Field */}
            <Flex direction={'column'} gap={'2'} mb={'5'}>
              <Label htmlFor="email" className="text-base">Teammate&apos;s Email</Label>
              <Input id="email" {...register("email", { required: "email is required" })}
                style={{
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: '#777777',
                  backgroundColor: '#2b2b2b'
                }}
              />
              {errors.email && <Text color="red">{errors.email.message}</Text>}
            </Flex>

            {/* DUPR Profile URL 
            <Flex direction={'column'} gap={'2'} mb={'5'}>
              <Label htmlFor="duprUrl" className="text-base">Teammate&apos;s DUPR Profile URL (Optional)</Label>
              <Input 
                id="duprUrl"
                {...register("duprUrl", {
                  validate: (value) => {
                    const dropdownValue = watch("dropdownValue");
                    if (!value && !dropdownValue) {
                      return "Please provide either a DUPR Profile URL or select a skill level.";
                    }
                    return true;
                  },
                })}
                placeholder="https://dashboard.dupr.com/dashboard/player/12345"
                style={{
                  borderStyle: 'solid',
                  borderWidth: '1px',
                  borderColor: '#777777',
                  backgroundColor: '#2b2b2b'
                }}
              />
            </Flex>
            */}

            {/* Dropdown Selection 
            <Flex direction={'column'} gap={'2'} mb={'5'}>
              <Label className="text-base">Teammate&apos;s skill level (if no DUPR)</Label>
              <Controller
                control={control}
                name="dropdownValue"
                rules={{
                  validate: (value) => {
                    const duprUrl = watch("duprUrl");
                    if (!duprUrl && !value) {
                      return "Please provide either a DUPR Profile URL or select a value.";
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger 
                      style={{
                        borderStyle: 'solid',
                        borderWidth: '1px',
                        borderColor: '#777777',
                        backgroundColor: '#2b2b2b'
                      }}
                    >
                    <SelectValue placeholder="Choose one"/>
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Flex>
            */}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !teammate1Id || !seasonId || !regionId}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Please wait..." : "Continue to Payment"}
            </Button>
          </form>
          
        </Box>
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

      {errors.duprUrl && (
        <Box m={'4'}>
          <Alert variant="destructive" style={{backgroundColor: "white"}}>
            <AlertCircle/>
            <VisuallyHidden>
              <AlertTitle>Input error</AlertTitle>
            </VisuallyHidden>
            <AlertDescription>
              {errors.duprUrl.message}
            </AlertDescription>
          </Alert>
        </Box>
      )}
    </Flex>
  )
}

export default function RegisterTeammate() {
  return (
    <Suspense>
      <RegisterTeammatePage />
    </Suspense>
  )
}