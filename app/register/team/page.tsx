"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Avatar, Box, Flex, Heading, Text, VisuallyHidden } from "@radix-ui/themes";
import Image from "next/image";
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCroppedImg } from "@/lib/cropImage";
import Cropper, { Area } from "react-easy-crop";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import AvailabilitySelection from "@/app/components/ui/setAvailability";
import { ApiErrorResponse } from "@/app/types/functionTypes";
import { ITeam, IUser } from "@/app/types/databaseTypes";

interface FormData {
  fullName: string;
  email: string;
  duprUrl?: string;
  dropdownValue?: string;
}



function RegisterTeamPage() {
  const { user } = useUser()
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    control,
    watch,
    //reset,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onBlur",
    defaultValues: {
      email: user?.email
    }
  });

  //const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [currentDbUser, setCurrentDbUser] = useState<IUser | null>(null);
  const [isFirstTimeInvite, setIsFirstTimeInvite] = useState(false);
  const [teammateIsRegistering, setTeammateIsRegistering] = useState<boolean>(false);

  const [regionId, setRegionId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  //const [imageAlreadySet, setImageAlreadySet] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [availabilityBlocks, setAvailabilityBlocks] = useState<{ day: string; time: string }[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  // Get currently logged in user
   useEffect(() => {
    if (!user) return;

      const fetchUser = async () => {
        try {
          const response = await fetch(`/api/users/auth0Id/?auth0Id=${user?.sub}`);
  
          if (!response.ok) {
            const errorData: ApiErrorResponse = await response.json();
            throw new Error(`API Error: ${errorData.systemMessage}`);
          }
  
          const currentUser = await response.json();
          setCurrentDbUser(currentUser.user);

          console.log ('current user:', currentUser);

          if (currentUser.user.firstTimeInvite) {
            setIsFirstTimeInvite(currentUser.user.firstTimeInvite)
          }

        } catch (error) {
          console.error('Error fetching current user:', error);
          setApiError((prev) => prev || "An unexpected error happened. Please try again. Code 430.");
        }
      };
  
      fetchUser();
    }, [user]);

    useEffect(() => {
      console.log('is invite:', isFirstTimeInvite);

    }, [isFirstTimeInvite])

    // Checking if the teammate or the captain is on the page.
    useEffect(() => {
        if (!currentDbUser || !seasonId) return;
        
        const fetchCurrentTeam = async() => {
          try {
            const getCurrentTeam = await fetch(
              `/api/teams/findByUserAndSeason?userId=${currentDbUser._id}&seasonId=${seasonId}`
            );
      
            if (!getCurrentTeam.ok) {
              throw new Error(`Failed to fetch team: ${getCurrentTeam.statusText}`);
            }
      
            const { team }: { team: ITeam } = await getCurrentTeam.json();
            console.log('Fetched team:', team);
    
            if (team.captain !== currentDbUser._id){
              setTeammateIsRegistering(true);
            }
              
          } catch (error) {
            console.error('Error fetching team:', error);
          }
          
        }
        fetchCurrentTeam();
        
      }, [currentDbUser, seasonId])

    /*

    useEffect(() => {
      if (croppedImage && croppedImage.startsWith("http")) {
        setImageAlreadySet(true);
      }
      console.log('currentUser:', currentUser)
    }, [croppedImage, currentUser])
    */

    /*
    // Pre-fill out form
    useEffect(() => {
      if (currentUser) {
        reset({
          fullName: currentUser.name || "",
          email: currentUser.email || user?.email || "",
          duprUrl: currentUser.duprUrl || "",
        });
    
        if (currentUser.profilePicture) {
          setCroppedImage(currentUser.profilePicture);
        }
    
        if (currentUser.availability) {
          setAvailabilityBlocks(currentUser.availability);
        }
      }
    }, [currentUser, reset, user]);
    */

  const onCropComplete = useCallback((_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const handleCropImage = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
  
    // Infer output format based on the selected image type
    const outputFormat = selectedImage.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";
  
    const base64CroppedImage = await getCroppedImg(
      selectedImage,
      croppedAreaPixels,
      outputFormat
    );
  
    setCroppedImage(base64CroppedImage);
    setCropping(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setCropping(true);
      };
    }
  };

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    setIsSubmitting(true);

    if (availabilityBlocks.length === 0) {
      setAvailabilityError("Please select at least one availability slot.");
      setIsSubmitting(false);
      return;
    }

    let imageUrl = croppedImage ?? "";

    if (croppedImage && !croppedImage.startsWith("http")) {
      const base64Data = croppedImage;
      const contentType = base64Data.match(/^data:(.*?);base64/)?.[1];

      const imageResponse = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: base64Data,
          contentType,
        }),
      });

      if (!imageResponse.ok) {
        throw new Error("Failed to upload image.");
      }

      const imageResult = await imageResponse.json();
      imageUrl = imageResult.imageUrl;
    }

    try {
      const userPayload = {
        name: data.fullName,
        profilePicture: imageUrl
          ? `${process.env.NEXT_PUBLIC_BASE_URL}${imageUrl}`
          : undefined,
        duprUrl: data.duprUrl,
        skillLevel: data.dropdownValue,
        availability: availabilityBlocks,
      };
      
      const userResponse = await fetch(`/api/users/email/${user?.email}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });
  
      if (!userResponse.ok) {
        const errorData: ApiErrorResponse = await userResponse.json();
        setApiError(errorData.userMessage);
        throw new Error(`Failed to update user: ${errorData.systemMessage}`);
      }
  
      const { updatedUser } = await userResponse.json();
      console.log("User updated successfully:", updatedUser);

      // Create team
      const teammate1Id = updatedUser._id
      let existingTeam = null;

      try {
        const existingTeamResponse = await fetch(
          `/api/teams/findByUserAndSeason?userId=${teammate1Id}&seasonId=${seasonId}`
        );
  
        if (existingTeamResponse.ok) {
          const { team } = await existingTeamResponse.json();
          existingTeam = team;
        } else if (existingTeamResponse.status !== 404) {
          const errorData: ApiErrorResponse = await existingTeamResponse.json();
          throw new Error(`Failed to check existing team: ${errorData.systemMessage}`);
        }
      } catch (err) {
        console.error('Error fetching existing team:', err);
        setIsSubmitting(false);
        return;
      }
     

      const teamPayload = teammateIsRegistering
        ? { registrationStep: 'TEAMMATE_REGISTERED' }
        : {
            captain: teammate1Id,
            registrationStep: 'CAPTAIN_REGISTERED',
            status: 'REGISTERED',
            teammates: [teammate1Id],
            regionId,
            seasonId,
      };

      let team;
      try {
        const teamResponse = await fetch(
          existingTeam ? `/api/teams/${existingTeam._id}` : '/api/teams',
          {
            method: existingTeam ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamPayload),
          }
        );

        if (!teamResponse.ok) {
          const errorData: ApiErrorResponse = await teamResponse.json();
          throw new Error(
            `Failed to ${existingTeam ? 'update' : 'create'} team: ${errorData.systemMessage}`
          );
        }

        const teamResult = await teamResponse.json();
        team = teamResult.team;
      } catch (err) {
        console.error('Team create/update failed:', err);
        setApiError('Failed to create or update team. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (isFirstTimeInvite) {
        router.push(`/register/success?seasonId=${seasonId}&regionId=${regionId}&teamId=${team._id}`);
      } else {
        router.push(`/register/team/teammate?seasonId=${seasonId}&regionId=${regionId}&teammate1=${updatedUser._id}&teamId=${team._id}`);
      }
      
    } catch (error) {
      console.error("Error creating user:", error);
      setApiError((prev) => prev || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCropping(false);
    resetImageState();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImageState = () => {
    setSelectedImage(null);
    setCroppedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetFileInput = (e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    input.value = "";
    resetImageState();
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && searchParams) {
      const regionIdParam = searchParams.get('regionId');
      const seasonIdParam = searchParams.get('seasonId');

      if (regionIdParam && seasonIdParam) {
        setRegionId(regionIdParam)
        setSeasonId(seasonIdParam)
      } else {
        router.push('/register')
      }
    }
  }, [router, searchParams]);

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
        <Heading as="h1">Enter your information</Heading>
      </Box>

      <Flex direction={'row'} gap={'4'} mb={'7'}>
        {croppedImage ? (
          <Avatar
          src={croppedImage}
          size={'7'}
          fallback="A"
          radius={"full"}
        />
        ) : (
          <Avatar fallback={user?.name?.[0] ?? "A"} radius="full" size={'7'}/>
        )}
        <Box>
          <Label htmlFor="profilePicture" className="text-base">Profile Picture</Label>
          <Input 
            ref={fileInputRef}
            id="picture"
            type="file"
            accept="image/*"
            onClick={handleResetFileInput}
            onChange={handleFileChange}
          />
        </Box>
      </Flex>

      <Dialog open={cropping} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crop Your Image</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Crop your image</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>

          {selectedImage && (
            <div className="relative w-full h-80 overflow-hidden bg-black">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}
          <div className="mt-4">
            <label className="text-sm font-medium">Zoom</label>
            <Slider 
              value={[zoom]} 
              min={1} 
              max={3} 
              step={0.1} 
              onValueChange={(value) => setZoom(value[0])} // Update zoom state
            />
          </div>
          <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleCropImage}>Crop & Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Flex direction={'column'} mx={'4'}>
        <Box>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name Field */}
            <Flex direction={'column'} gap={'2'} mb={'5'}>
              <Label htmlFor="fullName" className="text-base">Full Name</Label>
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
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input id="email" defaultValue={user?.email} disabled {...register("email", { required: "Email is required" })}
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
              <Label htmlFor="duprUrl" className="text-base">DUPR Profile URL (Optional)</Label>
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
              <Label className="text-base">Skill level (if no DUPR)</Label>
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
                      {["Beginner", "Intermediate", "Advanced"].map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Flex>

            <AvailabilitySelection onAvailabilityChange={setAvailabilityBlocks} />

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

            {availabilityError && (
              <Box m={'4'}>
                <Alert variant="destructive" style={{backgroundColor: "white"}}>
                  <AlertCircle/>
                  <VisuallyHidden>
                    <AlertTitle>Availability error</AlertTitle>
                  </VisuallyHidden>
                  <AlertDescription>
                    {availabilityError}
                  </AlertDescription>
                </Alert>
              </Box>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !seasonId || !regionId}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Please wait..." : "Continue"}
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
    </Flex>
  )
}

export default function RegisterTeam() {
  return (
    <Suspense>
      <RegisterTeamPage />
    </Suspense>
  )
}