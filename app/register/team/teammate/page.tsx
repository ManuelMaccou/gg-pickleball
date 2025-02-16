// http://localhost:3000/register/team/teammate?teammate1=67ae71665833c2dff397bc18&regionId=67aaed654bf05bdbe38ca440&seasonId=67aa859d7852366cccb37379

"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Box, Flex, Heading, Text, VisuallyHidden } from "@radix-ui/themes";
import Image from "next/image";
import lightGGLogo from '../../../../public/gg_logo_white_transparent.png'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { ApiErrorResponse } from "@/app/types/functionTypes";

interface FormData {
  fullName: string;
  email: string;
  dupr: number;
  duprUrl?: string;
  dropdownValue?: string;
}

const options = ["Beginner", "Intermediate", "Advanced"];

export default function RegisterTeam() {

  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onBlur",
  });

  const [teammate1Id, setTeammate1Id] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const handleCheckBox = (value: boolean) => {
    setChecked(value);
  };

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    setIsSubmitting(true);

    try {
      const userPayload = {
        name: data.fullName,
        email: data.email,
        dupr: data.dupr,
        duprUrl: data.duprUrl,
        skillLevel: data.dropdownValue,
      };

      // Check if user with email exists
      const existingUserResponse = await fetch(`/api/users/email?email=${data.email}`);
      const { exists, user } = await existingUserResponse.json();

      let teammate2Id;
      
      if (!exists) {
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
        console.log("Teammate 2 created successfully:", user);

      } else {
        teammate2Id = user._id;
        console.log("not creating a new user");
      }

      const teamPayload = {
        teammateId: teammate2Id,
        registrationStep: "REGISTERED_TEAMMATE",
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
  
      // Fallback error message for non-API errors (e.g., network issues)
      if (!apiError) {
        setApiError('An unexpected error occurred. Please try again.');
      }
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

      if (teammate1Param) {
       setTeammate1Id(teammate1Param)
      }

      if (regionIdParam) {
        setRegionId(regionIdParam)
      }

      if (seasonIdParam) {
        setSeasonId(seasonIdParam)
      }

      if (teamIdParam) {
        setTeamId(teamIdParam)
      }
    }
  }, [searchParams]);

  return (
    <Flex minHeight={'100vh'} direction={'column'} mx={'5'} pb={'9'}>
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

            {/* DUPR Profile URL */}
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

            {/* Dropdown Selection */}
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

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !teammate1Id || !seasonId || !regionId || !checked}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Please wait..." : "Continue to Payment"}
            </Button>

            <Flex direction={'row'} gap={'3'} my={'5'}>
              <Checkbox
                id="terms"
                className="w-6 h-6"
                checked={checked}
                onCheckedChange={handleCheckBox}
              />
              <label
                htmlFor="terms"
                className="text-m font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                This payment covers the 1-month registration fee for you and your teammate. By continuing, you agree to our terms of service and privacy policies.
              </label>
            </Flex>
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