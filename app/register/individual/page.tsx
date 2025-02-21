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

interface FormData {
  fullName: string;
  email: string;
  duprUrl?: string;
  dropdownValue?: string;
}

const options = ["Beginner", "Intermediate", "Advanced"];

function RegisterIndividualPage() {
  const { user } = useUser()
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
    defaultValues: {
      email: user?.email
    }
  });

  const [regionId, setRegionId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [availabilityBlocks, setAvailabilityBlocks] = useState<{ day: string; time: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

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

    let imageUrl = "";

    if (croppedImage) {
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
      imageUrl = imageResult.imageUrl; // This is the /api/images/[id] URL
    }

    try {
      let userPayload;
      if (imageUrl) {
        // Need to change this create user to an update user
        userPayload = {
          name: data.fullName,
          email: user?.email,
          profilePicture: `${process.env.NEXT_PUBLIC_BASE_URL}${imageUrl}`,
          duprUrl: data.duprUrl,
          skillLevel: data.dropdownValue,
          availability: availabilityBlocks,
        };
      } else {
        userPayload = {
          name: data.fullName,
          email: user?.email,
          duprUrl: data.duprUrl,
          skillLevel: data.dropdownValue,
          availability: availabilityBlocks,
        }
      }
  
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
      console.log("User created successfully:", createdUser);

      // Create team
      const teammate1Id = createdUser._id
      const teamPayload = {
        teammates: [teammate1Id],
        captain: teammate1Id,
        regionId,
        seasonId,
        registrationStep: "CAPTAIN_REGISTERED",
        status: "REGISTERED",
        individual: true,
      };

      const teamResponse = await fetch("/api/teams", {
        method: "POST",
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

      router.push(`/register/individual/success?seasonId=${seasonId}&regionId=${regionId}&teammate1=${createdUser._id}&teamId=${team._id}`);
      
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

    // Clear file input if it exists
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
  
        if (regionIdParam) {
          setRegionId(regionIdParam)
        }
  
        if (seasonIdParam) {
          setSeasonId(seasonIdParam)
        }
      }
    }, [searchParams]);

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
          <Avatar fallback="A" radius="full" size={'7'}/>
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

            <AvailabilitySelection onAvailabilityChange={setAvailabilityBlocks} />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !seasonId || !regionId}
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Please wait..." : "Register"}
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

export default function RegisterIndividual() {
  return (
    <Suspense>
      <RegisterIndividualPage />
    </Suspense>
  )
}