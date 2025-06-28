"use client"

import * as React from "react"
import { useState } from "react";
import {
  Dialog,
  Button,
  Flex,
  Switch,
  Text,
  TextField,
  VisuallyHidden
} from "@radix-ui/themes"
import Image from "next/image";
import { Cross2Icon, HamburgerMenuIcon } from "@radix-ui/react-icons";
import { FrontendUser } from "../types/frontendTypes";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LocationDrawerProps {
  user: FrontendUser | null;
  isAuthorized: boolean;
}

export default function MenuDrawer({ user, isAuthorized }: LocationDrawerProps) {
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);

  const [duprId, setDuprId] = useState<string>(user?.dupr?.duprId || "");
  const [duprIdLoading, setDuprIdLoading] = useState(false);
  const [duprIdError, setDuprIdError] = useState<string | null>(null);
  const [duprIdSuccess, setDuprIdSuccess] = useState(false);

  const [duprActivated, setDuprActivated] = useState<boolean>(user?.dupr?.activated || false);
  const [duprActivationError, setDuprActivationError] = useState<string | null>(null);
  const [duprActivationSuccess, setDuprActivationSuccess] = useState(false);

  const handleSaveDisplayName = async () => {
    setDisplayNameLoading(true);
    setDisplayNameError(null);
    setDisplayNameSuccess(false);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          findBy: "userId",
          userId: user?._id,
          name: displayName,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to update user.");
      }

      setDisplayNameSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDisplayNameError(err.message);
      } else {
        setDisplayNameError("An unknown error occurred.");
      }
    } finally {
      setDisplayNameLoading(false);
    }
  };

  const handleSaveDuprId = async () => {
    setDuprIdLoading(true);
    setDuprIdError(null);
    setDuprIdSuccess(false);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          findBy: "userId",
          userId: user?._id,
          dupr: {
            duprId
          }
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to update user.");
      }

      setDuprIdSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDuprIdError(err.message);
      } else {
        setDuprIdError("An unknown error occurred.");
      }
    } finally {
      setDuprIdLoading(false);
    }
  };

const handleToggleDuprActivation = async (newValue: boolean) => {
  setDuprActivationError(null);
  setDuprActivationSuccess(false);
  setDuprActivated(newValue);

  try {
    const response = await fetch("/api/user", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        findBy: "userId",
        userId: user?._id,
        dupr: {
          activated: newValue,
        },
      }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || "Failed to update user.");
    }

    setDuprActivationSuccess(true);
  } catch (err: unknown) {
    setDuprActivated(!newValue); // revert toggle
    if (err instanceof Error) {
      setDuprActivationError(err.message);
    } else {
      setDuprActivationError("An unknown error occurred.");
    }
  }
};

  return (

    <Dialog.Root>
      <Dialog.Trigger>
        <Flex direction="column" justify="center" align="center" mx="4">
        <HamburgerMenuIcon width="30px" height="30px" />
      </Flex>
      </Dialog.Trigger>

      <Dialog.Content>
       <Flex direction="column">
        <VisuallyHidden>
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Edit profile</Dialog.Description>
        </VisuallyHidden>
         
            <Flex direction="column" gap="4" height={'80vh'}>
              <Flex direction={isAuthorized ? 'row' : 'column'} justify={isAuthorized ? 'between' : 'start'} align={isAuthorized ? 'center' : 'end'} mb={'5'}>
                {isAuthorized && (
                  <Button variant="outline" asChild>
                    <Link href={'/auth/logout'}>Log out</Link>
                  </Button>
                )}
                
                <Dialog.Close>
                  <Cross2Icon height={25} width={25} />
                </Dialog.Close>
              </Flex>
              
               {isAuthorized ? (
                <>
              <Flex direction="column" gap={'2'}>
                <Text size={'3'} weight={'bold'} style={{color: 'white'}}>Display name</Text>
                <TextField.Root
                  size={'3'}
                  type="text"
                  radius="large"
                  value={displayName}
                  placeholder="Enter your display name"
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Flex direction={'row'} justify={displayNameError || displayNameSuccess ? 'between' : 'end'} mt={'2'}>
                  {displayNameError && <Text color="red">{displayNameError}</Text>}
                  {displayNameSuccess && <Text color="green">Profile updated</Text>}

                  <Button onClick={handleSaveDisplayName} disabled={displayNameLoading || displayName.trim() === ""} style={{backgroundColor: 'white', color: "#111827", width: 'fit-content', paddingLeft: '20px', paddingRight: '20px', alignSelf: 'end'}}>
                    {displayNameLoading ? "Saving..." : "Save"}
                  </Button>
                </Flex>
              </Flex>

              <Flex direction={'column'} gap={'6'}>
                <Flex direction={'column'} gap={'3'}>
                  <Flex direction={'row'} position={'relative'}>
                    <Image
                      src={'/partnerLogos/dupr_logo.png'}
                      alt="dupr logo"
                      priority
                      height={500}
                      width={1683}
                      style={{maxHeight: '35px', width: 'auto'}}
                    />
                  </Flex>
                  <Text size={'3'}>
                    Optionally provide your DUPR ID to have your matches uploaded. 
                    All players in the match must have this option toggled.
                  </Text>
                </Flex>

                <Flex direction={'column'} gap={'1'}>
                  <Text size={'5'} weight={'bold'}>Step 1</Text>
                  <Text size={'3'} weight={'bold'}>Join our club</Text>
                  <Text size={'3'}>
                    We can&apos;t upload your match until you&apos;ve joined our club on DUPR.
                  </Text>
                  <Button size={'2'} asChild mt={'2'} style={{backgroundColor: 'white'}}>
                    <Link href={'https://dashboard.dupr.com/dashboard/browse/clubs/7456531284'} target="blank">Join</Link>
                  </Button>
                </Flex>

                <Flex direction={'column'} gap={'2'}>
                  <Text size={'5'} weight={'bold'}>Step 2</Text>
                  <Text size={'3'} weight={'bold'}>Enter your DUPR ID</Text>
                  <TextField.Root
                    size={'3'}
                    type="text"
                    radius="large"
                    value={duprId ?? ""}
                    placeholder="123ABC"
                    onChange={(e) => setDuprId(e.target.value)}
                  />
                  <Flex direction={'row'} justify={duprIdError || duprIdSuccess ? 'between' : 'end'} mt={'2'}>
                    {duprIdError && <Text color="red">{duprIdError}</Text>}
                    {duprIdSuccess && <Text color="green">DUPR ID Saved</Text>}

                    <Button onClick={handleSaveDuprId} disabled={duprIdLoading || displayName.trim() === ""} style={{backgroundColor: 'white', color: "#111827", width: 'fit-content', paddingLeft: '20px', paddingRight: '20px', alignSelf: 'end'}}>
                      {duprIdLoading ? "Saving..." : "Save"}
                    </Button>
                  </Flex>
                </Flex>

                <Flex direction={'column'} gap={'4'} mb={'9'}>
                  <Text size={'5'} weight={'bold'}>Step 3</Text>
                  <Flex direction={'row'} gap={'4'} align={'center'}>
                    <Switch
                      size={'3'}
                      color="blue"
                      checked={duprActivated}
                      onCheckedChange={handleToggleDuprActivation}
                      disabled={!(duprIdSuccess || user?.dupr?.duprId)}
                    />
                    <Text size={'3'}>Upload my matches to DUPR</Text>
                  </Flex>
                  <Flex direction={'column'}>
                    {duprActivationError && <Text color="red">{duprIdError}</Text>}
                    {duprActivationSuccess && <Text color="green">Updated</Text>}
                  </Flex>
                </Flex>
              </Flex>
            </>
          ) : (
            <Flex direction="column" justify={'center'} align={'center'} gap={'7'} mt={'-9'} height={'100%'}>
              <Text size={'3'}>
                Create an account to change your display name and connect DUPR.
              </Text>
              <Button variant='outline' onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/new')}>Create account / Log in</Button>
            </Flex>
          )}
          </Flex>
          
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
