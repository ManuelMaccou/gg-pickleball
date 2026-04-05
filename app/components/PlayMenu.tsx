"use client"

import * as React from "react"
import { useState } from "react";
import {
  Dialog,
  Button,
  Flex,
  Text,
  TextField,
  VisuallyHidden,
  Separator,
  Heading,
  Card,
  Badge,
  IconButton,
  Box
} from "@radix-ui/themes"
import Image from "next/image";
import { Cross2Icon, HamburgerMenuIcon } from "@radix-ui/react-icons";
import { FrontendUser } from "../types/frontendTypes";
import { useUserContext } from "../contexts/UserContext";
import { User, Mail, Link as LinkIcon, CheckCircle2 } from "lucide-react"; // Added standard icons

interface PlayMenuProps {
  user: FrontendUser | null;
  isAuthorized: boolean;
  onUserUpdate: (user: FrontendUser | null) => void;
  onInitiateDuprLogin: () => void;
}

export default function PlayMenu({ user, isAuthorized, onUserUpdate, onInitiateDuprLogin }: PlayMenuProps) {
  const { user:userContextUser } = useUserContext()
  
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);

  const [duprActivationError, setDuprActivationError] = useState<string | null>(null);
  const [duprActivationSuccess, setDuprActivationSuccess] = useState(false);

  const guestUsername = userContextUser?.isGuest ? userContextUser.name : null;
  let loginUrl = '/auth/login?screen_hint=signup&returnTo=/play';
  if (guestUsername) {
    loginUrl += `&guest_username=${encodeURIComponent(guestUsername)}`;
  }

  const handleSaveDisplayName = async () => {
    setDisplayNameLoading(true);
    setDisplayNameError(null);
    setDisplayNameSuccess(false);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

      const updatedUser = await response.json();

      onUserUpdate(updatedUser)
      setDisplayNameSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setDisplayNameSuccess(false), 3000);
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

  const isDuprConnected = !!user?.dupr?.id;

  return (
    <Flex direction={'column'}>
      <Dialog.Root>
        <Dialog.Trigger>
          <IconButton 
            variant="ghost" 
            color="gray" 
            radius="full" 
            size="3" 
            style={{ cursor: 'pointer', color: 'var(--slate-12)' }}
          >
            <HamburgerMenuIcon width="24" height="24" />
          </IconButton>
        </Dialog.Trigger>

        <Dialog.Content 
            maxWidth="450px" 
            style={{ padding: '24px', borderRadius: '24px', backgroundColor: '#ffffff' }}
            onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <VisuallyHidden>
            <Dialog.Title>Account Menu</Dialog.Title>
            <Dialog.Description>Manage your account settings and connections.</Dialog.Description>
          </VisuallyHidden>
          
          <Flex direction="column" gap="4">
            
            {/* Header Area */}
            <Flex justify="between" align="center" mb="2">
                <Heading size="5" style={{ color: 'var(--slate-12)', letterSpacing: '-0.01em' }}>Account Settings</Heading>
                <Dialog.Close>
                    <IconButton variant="ghost" color="gray" radius="full" style={{ cursor: 'pointer' }}>
                        <Cross2Icon width="20" height="20" />
                    </IconButton>
                </Dialog.Close>
            </Flex>
            
            {isAuthorized ? (
              <>
                {/* --- DISPLAY NAME SECTION --- */}
                <Card size="2" style={{ backgroundColor: 'var(--slate-1)', border: '1px solid var(--slate-4)', borderRadius: '16px', padding: '20px' }}>
                    <Flex direction="column" gap="3">
                        <Flex align="center" gap="2" mb="1">
                            <User size={18} color="var(--slate-11)" />
                            <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>Display Name</Text>
                        </Flex>
                        
                        <TextField.Root
                            size="3"
                            radius="large"
                            value={displayName}
                            placeholder="Enter your display name"
                            onChange={(e) => setDisplayName(e.target.value)}
                            style={{ backgroundColor: 'white' }}
                        />
                        
                        <Flex direction="row" justify="between" align="center" mt="1">
                            <Box>
                                {displayNameError && <Text size="2" color="red">{displayNameError}</Text>}
                                {displayNameSuccess && <Text size="2" color="green" weight="medium">Profile updated!</Text>}
                            </Box>

                            <Button 
                                size="2"
                                radius="full"
                                onClick={handleSaveDisplayName} 
                                disabled={displayNameLoading || displayName.trim() === "" || displayName === user?.name} 
                                style={{
                                    backgroundColor: 'var(--slate-12)', 
                                    color: "white", 
                                    paddingLeft: '20px', 
                                    paddingRight: '20px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {displayNameLoading ? "Saving..." : "Save"}
                            </Button>
                        </Flex>
                    </Flex>
                </Card>

                {/* --- DUPR CONNECTION SECTION --- */}
                <Card size="2" style={{ backgroundColor: 'var(--slate-1)', border: '1px solid var(--slate-4)', borderRadius: '16px', padding: '20px' }}>
                    <Flex direction="column" gap="4" >
                        <Image
                            src={'/partnerLogos/dupr_logo_dark.png'} // Note: Ensure this is a dark/visible logo on a light background!
                            alt="DUPR logo"
                            priority
                            height={145}
                            width={500}
                            style={{ maxWidth: '150px', height: 'auto', alignSelf: 'center' }}
                        />
                        <Text size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.5 }}>
                            Connect your DUPR account to automatically sync your match history and unlock exclusive rewards.
                        </Text>

                        <Flex direction="column" gap="2" mt="2">
                            {!isDuprConnected ? (
                                <Flex direction="column" gap="3">
                                    <Dialog.Close>
                                        <Button 
                                            size="3" 
                                            radius="full"
                                            onClick={onInitiateDuprLogin}
                                            style={{ backgroundColor: 'var(--lime-9)', color: 'var(--slate-12)', fontWeight: 'bold', width: '100%', cursor: 'pointer' }}
                                        >
                                            <LinkIcon size={16} style={{ marginRight: '8px' }} />
                                            Connect DUPR Account
                                        </Button>
                                    </Dialog.Close>
                                </Flex>
                            ) : (
                                <Flex align="center" gap="2" p="3" style={{ backgroundColor: 'var(--green-2)', border: '1px solid var(--green-5)', borderRadius: '12px' }}>
                                    <CheckCircle2 size={20} color="var(--green-10)" />
                                    <Box>
                                        <Text as="div" size="2" weight="bold" style={{ color: 'var(--green-11)' }}>Connected</Text>
                                        <Text as="div" size="1" style={{ color: 'var(--green-10)' }}>ID: {user?.dupr?.id}</Text>
                                    </Box>
                                </Flex>
                            )}
                            
                            <Box mt="2">
                                {duprActivationError && <Text size="2" color="red">{duprActivationError}</Text>}
                                {duprActivationSuccess && <Text size="2" color="green">Updated</Text>}
                            </Box>
                        </Flex>
                    </Flex>
                </Card>

                {/* --- CONTACT SECTION --- */}
                <Card size="2" style={{ backgroundColor: 'var(--slate-1)', border: '1px solid var(--slate-4)', borderRadius: '16px', padding: '20px' }}>
                    <Flex direction="column" gap="2">
                        <Flex align="center" gap="2" mb="1">
                            <Mail size={18} color="var(--slate-11)" />
                            <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>Contact Us</Text>
                        </Flex>
                        <Text size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.5, marginBottom: '12px' }}>
                            Questions, comments, or issues? We would love to hear from you!
                        </Text>
                        <Button size="3" variant="soft" color="gray" radius="full" asChild style={{ fontWeight: 'bold' }}>
                            <a href="mailto:play@ggpickleball.co" target="_blank" rel="noopener noreferrer">
                                Send us an email
                            </a>
                        </Button>
                    </Flex>
                </Card>

                {/* --- LOG OUT --- */}
                <Flex justify="center" mt="4">
                    <Button variant="ghost" color="red" size="3" asChild style={{ fontWeight: 'bold' }}>
                        <a href="/auth/logout">Log out securely</a>
                    </Button>
                </Flex>

              </>
            ) : (
              // --- GUEST VIEW ---
              <Flex direction="column" align="center" justify="center" gap="5" py="6" px="4" style={{ backgroundColor: 'var(--slate-1)', borderRadius: '16px', border: '1px solid var(--slate-4)' }}>
                <Box style={{ backgroundColor: 'var(--slate-3)', padding: '16px', borderRadius: '50%' }}>
                    <User size={32} color="var(--slate-11)" />
                </Box>
                
                <Flex direction="column" gap="2" align="center" style={{ textAlign: 'center' }}>
                  <Heading size="4" style={{ color: 'var(--slate-12)' }}>Playing as Guest</Heading>
                  <Text size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.5 }}>
                    To ensure your stats are saved and to connect to DUPR, please create a free account.
                  </Text>
                </Flex>
                
                <Button size="3" radius="full" asChild style={{ backgroundColor: 'var(--lime-9)', color: 'var(--slate-12)', fontWeight: 'bold', width: '100%', marginTop: '8px' }}>
                  <a href={loginUrl}>Create Free Account</a>
                </Button> 
              </Flex>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}