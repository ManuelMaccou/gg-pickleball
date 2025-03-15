"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useForm, Controller } from "react-hook-form";
import { Avatar, Box, Flex, Heading, Text, VisuallyHidden } from "@radix-ui/themes";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCroppedImg } from "@/lib/cropImage";
import Cropper, { Area } from "react-easy-crop";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckIcon, Loader2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { ApiErrorResponse } from "@/app/types/functionTypes";
import { IUser } from "@/app/types/databaseTypes";
import DesktopSidebar from "../components/Sections/DesktopSidebar";
import TopBanner from "../components/Sections/TopBanner";
import AvailabilitySelection from "../components/ui/setAvailability";

interface FormData {
  fullName: string;
  email: string;
  duprUrl?: string;
  dropdownValue?: string;
}

export default function ProfilePage() {
  const { user } = useUser()

  //const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [currentDbUser, setCurrentDbUser] = useState<IUser | null>(null);

  //const [imageAlreadySet, setImageAlreadySet] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [availabilityBlocks, setAvailabilityBlocks] = useState<{ day: string; time: string }[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);


  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onBlur",
    defaultValues: {
      email: user?.email,
      fullName: currentDbUser?.name,
      dropdownValue: currentDbUser?.skillLevel || "",
    }
  });

  useEffect(() => {
    if (currentDbUser) {
      reset({
        fullName: currentDbUser.name || "",
        email: user?.email || "",
        dropdownValue: currentDbUser.skillLevel || "",
      });
    }
  }, [currentDbUser, reset, user]);

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

        } catch (error) {
          console.error('Error fetching current user:', error);
          setApiError((prev) => prev || "An unexpected error happened. Please try again. Code 430.");
        }
      };
  
      fetchUser();
    }, [user]);

    useEffect(() => {
      if (currentDbUser && currentDbUser.availability && availabilityBlocks.length === 0) {
        console.log("📌 Initializing availabilityBlocks from database:", currentDbUser.availability);
        setAvailabilityBlocks(currentDbUser.availability);
      }
    }, [availabilityBlocks.length, currentDbUser]);

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
    setIsSavingProfile(true);
    setAvailabilityError("");
    setIsSavingAvailability(false)
    setAvailabilitySaved(false)
    setProfileSaved(false)

    let imageUrl = croppedImage ?? "";

    if (croppedImage && !croppedImage.startsWith("http")) {
      const base64Data = croppedImage;
      const contentType = base64Data.match(/^data:(.*?);base64/)?.[1];
      try {
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
      } catch (error) {
        console.error("Error uploading image:", error);
        setApiError("Failed to upload image. Please try again.");
        setIsSavingProfile(false);
        return;
      }
    }

    try {
      const userPayload = {
        name: data.fullName,
        profilePicture: imageUrl
          ? `${process.env.NEXT_PUBLIC_BASE_URL}${imageUrl}`
          : undefined,
        duprUrl: data.duprUrl,
        skillLevel: data.dropdownValue,
      };
      
      const userResponse = await fetch(`/api/users/email/${user?.email}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });
  
      if (!userResponse.ok) {
        const errorData: ApiErrorResponse = await userResponse.json();
        throw new Error(`Failed to update user: ${errorData.systemMessage}`);
      }
  
      const { updatedUser } = await userResponse.json();
      setProfileSaved(true)
      console.log("User updated successfully:", updatedUser);
      
    } catch (error) {
      console.error("Error updating user:", error);
      setApiError((prev) => prev || "An error occurred. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvailabilitySave = async () => {

    setApiError(null);
    setIsSavingProfile(false);
    setAvailabilityError("");
    setIsSavingAvailability(true);
    setAvailabilitySaved(false)
    setProfileSaved(false)

    if (availabilityBlocks.length === 0) {
      setAvailabilityError("Please select at least one availability slot.");
      setIsSavingAvailability(false);
      return;
    }

    try {
      const userPayload = {
        availability: availabilityBlocks,
      };
      
      const userResponse = await fetch(`/api/users/email/${user?.email}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPayload),
      });
  
      if (!userResponse.ok) {
        const errorData: ApiErrorResponse = await userResponse.json();
        throw new Error(`Failed to update user: ${errorData.systemMessage}`);
      }
  
      const { updatedUser } = await userResponse.json();
      setAvailabilitySaved(true)
      console.log("Availability updated successfully:", updatedUser);
      
    } catch (error) {
      console.error("Error updating availability:", error);
      setAvailabilityError((prev) => prev || "An error occurred. Please try again.");
    } finally {
      setIsSavingAvailability(false);
    }
  }

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

  /*
  const transformUserAvailability = (availability: IUserAvailability[] | undefined): Record<string, TimeBlock[]> => {
    if (!availability) return {};
  
    return availability.reduce((acc, { day, time }) => {
      if (!acc[day]) acc[day] = [];
  
      const [start, end] = time.split("-");
      acc[day].push({ start, end });
  
      return acc;
    }, {} as Record<string, TimeBlock[]>);
  };
  
 const formattedAvailability = useMemo(() => transformUserAvailability(currentDbUser?.availability), [currentDbUser?.availability]);
 */ 

  if (!user) return null

  return (
    <Flex direction={{initial: 'column', md: 'row'}} minHeight={'100vh'} px={{initial: '0', md: '5'}} pb={'9'}>
      <Flex display={{ initial: 'none', md: 'flex' }}>
        <DesktopSidebar />
      </Flex>

      <Flex direction={'column'} display={{ initial: 'flex', md: 'none' }}>
        <TopBanner />
      </Flex>
      
      <Flex direction={'column'} px={'4'} width={{initial: "100%", md: "60%"}} style={{marginRight: 'auto', marginLeft: 'auto'}}>
        <Flex direction={'column'} p={'4'} gap={'2'}>
          <Heading as="h1">Profile</Heading>
        </Flex>

        <Flex direction={'row'} gap={'4'} mb={'7'} p={'4'}>
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
                <Input id="fullName" defaultValue={currentDbUser?.name} {...register("fullName", { required: "Full Name is required" })}
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
                  defaultValue={currentDbUser?.duprUrl}
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
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

              {profileSaved && (
                <Flex direction={'row'} align={'center'} gap={'2'} my={'4'}>
                  <Text color="green" size={'5'}>Profile saved</Text>
                  <CheckIcon color="green"/>
                </Flex>
              )}

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
              
              <Button
                type="submit"
                className="w-full sm:w-auto md:w-1/2 lg:w-1/3"
                disabled={isSavingProfile}
              >
                {isSavingProfile && <Loader2 className="animate-spin" />}
                {isSavingProfile ? "Please wait..." : "Save profile"}
              </Button>

            {/*
               <UpdatedAvailabilitySelection 
               userAvailability={formattedAvailability} // ✅ Passes the correctly formatted object
               onAvailabilityChange={(processedAvailability) => {
                 console.log("✅ Received from child:", processedAvailability);
               }}
             />;
            */}

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

              {availabilitySaved && (
                <Flex direction={'row'} align={'center'} gap={'2'} my={'4'}>
                  <Text color="green" size={'5'}>Availabilty saved</Text>
                  <CheckIcon color="green"/>
                </Flex>
              )}

              <Button
                className="w-full sm:w-auto md:w-1/2 lg:w-1/3"
                disabled={isSavingAvailability || !availabilityBlocks}
                onClick={handleAvailabilitySave}
              >
                {isSavingAvailability && <Loader2 className="animate-spin" />}
                {isSavingAvailability ? "Please wait..." : "Save availability"}
              </Button>
            </form>
          </Box>
        </Flex>

        
      </Flex>
    </Flex>
  )
}