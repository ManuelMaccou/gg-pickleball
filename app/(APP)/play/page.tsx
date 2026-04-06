'use client'

import { Box, Button, Flex, Spinner, Text, Select, Card, Heading, IconButton, Dialog } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
// Changed to the black logo for the light background header
import darkGgLogo from '../../../public/logos/gg_logo_black_transparent.png'
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useEffect, useMemo, useState } from 'react';
import { IClient, IDataSource } from '@/app/types/databaseTypes';
import { FrontendUser, SelectableItem } from '@/app/types/frontendTypes';
import { Types } from "mongoose";
import MatchHistory from "@/components/sections/MatchHistory";
import { HowToDialog } from "./components/HowToDialog";
import PlayMenu from "@/app/components/PlayMenu";
import GlobalRewardsWallet from "@/components/sections/GlobalRewardsWallet";
import { Cross1Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
// Added Lucide Icons to match the requested design aesthetic
import { Trophy, Clock, MapPin, RefreshCw, ChevronDown, LinkIcon } from "lucide-react";
import { useIsMobile } from "@/app/hooks/useIsMobile";

export type SelectableLocation = Omit<IClient, '_id'> & {
  _id: Types.ObjectId | string;
};

export default function Play() {

  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user: contextUser } = useUserContext(); 

  const [allClients, setAllClients] = useState<IClient[]>([])
  const [allDataSources, setAllDataSources] = useState<IDataSource[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [dbUser, setDbUser] = useState<FrontendUser | null>(null)
  const [showHowToDialog, setShowHowToDialog] = useState<boolean>(false)
  const [isFetchingDbUser, setIsFetchingDbUser] = useState(true);
  const [showDuprFrame, setShowDuprFrame] = useState(false);
  const [isDuprSyncing, setIsDuprSyncing] = useState(false);

  const [duprErrorOpen, setDuprErrorOpen] = useState(false);
  const [duprErrorMessage, setDuprErrorMessage] = useState("");
    
  // --- AUTH STATUS LOGIC ---
  const authenticationStatus = useMemo(() => {
    if (auth0IsLoading || isFetchingDbUser) return 'loading';
    if (auth0User && dbUser) return 'authenticated';
    if (contextUser?.isGuest && dbUser) return 'guest';
    return 'anonymous';
  }, [auth0IsLoading, isFetchingDbUser, auth0User, dbUser, contextUser]);

  // --- DUPR CONFIG ---
  const duprClientId = process.env.NEXT_PUBLIC_DUPR_CLIENT_ID;
  const duprConfig = useMemo(() => {
    const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
    const baseUrl = appEnv === 'production' ? 'https://prod.mydupr.com' : 'https://uat.dupr.gg';
    if (!duprClientId) return { loginUrl: '', origin: '' };
    return { loginUrl: `${baseUrl}/login-external-app/${btoa(duprClientId)}`, origin: baseUrl };
  }, [duprClientId]);

  // --- DUPR LISTENER ---
  useEffect(() => {
    const handleDuprMessage = async (event: MessageEvent) => {
      console.log("Received message from origin:", event.origin);

      if (event.origin !== duprConfig.origin) return;
      console.log("🚨 FULL DUPR MESSAGE DATA:", event.data);

      const data = event.data;
      if (data && data.userToken && data.duprId) {
        setShowDuprFrame(false);
        
        try {
          const response = await fetch("/api/user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              findBy: "userId",
              userId: dbUser?._id,
              dupr: { id: data.duprId, userToken: data.userToken, refreshToken: data.refreshToken },
            }),
          });
         if (!response.ok) {
             const errorData = await response.json();
             // We use errorData.error from your backend, or a fallback if it's missing
             throw new Error(errorData.error || "Failed to save DUPR info.");
          }
          const updatedUser = await response.json();
          setDbUser(updatedUser); 
        } catch (error: unknown) { 
          console.error("Error saving DUPR info:", error);
          
          // Safely extract the message whether it's an Error object or a string
          let message = "An unexpected error occurred while connecting to DUPR.";
          if (error instanceof Error) {
            message = error.message;
          } else if (typeof error === "string") {
            message = error;
          }

          setDuprErrorMessage(message);
          setDuprErrorOpen(true);
        }
      }
    };
    if (duprConfig.origin) window.addEventListener('message', handleDuprMessage);
    return () => { if (duprConfig.origin) window.removeEventListener('message', handleDuprMessage); };
  }, [dbUser, duprConfig]);

  const handleInitiateDuprLogin = () => {
    if (!duprConfig.loginUrl) { alert("DUPR integration is not configured."); return; }
    setShowDuprFrame(true);
  };

  const handleUserUpdate = (updatedUser: FrontendUser | null) => setDbUser(updatedUser);
  const clientId: string | undefined = selectedItem?.type === 'client' ? selectedItem._id : undefined;

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [clientsRes, dataSourcesRes] = await Promise.all([
          fetch('/api/client'),
          fetch('/api/data-source')
        ]);
        if (!clientsRes.ok) throw new Error('Failed to fetch clients');
        const clientsData = await clientsRes.json();
        const dataSourcesData = await dataSourcesRes.json().catch(() => ({ dataSources: [] }));
        setAllClients(clientsData.clients || []);
        setAllDataSources(dataSourcesData.dataSources || []);
      } catch (error) { console.error('Error fetching initial page data:', error); }
    };
    fetchInitialData();
  }, []);

  // --- SELECTABLE ITEMS LOGIC ---
  const selectableItems = useMemo(() => {
    const isClientSelectable = (client: IClient) => 
      client.active && Array.isArray(client.achievements) && client.achievements.length > 0 &&
      client.rewardsPerAchievement && Object.keys(client.rewardsPerAchievement).length > 0;

    const clientItems: SelectableItem[] = allClients.filter(isClientSelectable).map((client) => ({
      _id: client._id.toString(), name: client.name, displayIcon: client.logo, type: 'client', originalData: client,
    }));
    const dataSourceItems: SelectableItem[] = allDataSources.filter(source => source.active).map((source) => ({
      _id: source._id.toString(), name: source.name, displayIcon: source.icon, type: 'dataSource', originalData: source,
    }));
    return [...dataSourceItems, ...clientItems];
  }, [allClients, allDataSources]);

  // --- COOKIE LOGIC ---
  useEffect(() => {
    if (selectableItems.length === 0) return;
    const setItemFromCookie = async () => {
        if (selectableItems.length === 1) { setSelectedItem(selectableItems[0]); return; }
        const lastLocationCookie = document.cookie.split('; ').find((row) => row.startsWith('lastLocation='))?.split('=')[1];
        if (lastLocationCookie) {
          const lastItem = selectableItems.find((item) => item._id === lastLocationCookie);
          if (lastItem) { setSelectedItem(lastItem); } 
          else { setSelectedItem(selectableItems[0]); document.cookie = `lastLocation=${selectableItems[0]._id}; path=/; max-age=${60 * 60 * 24 * 30}`; }
        } else {
          setSelectedItem(selectableItems[0]);
          document.cookie = `lastLocation=${selectableItems[0]._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
        }
    };
    setItemFromCookie();
  }, [selectableItems]);

  // --- USER FETCH ---
  useEffect(() => {
    const fetchUser = async () => {
      if (auth0User && dbUser && dbUser.auth0Id === auth0User.sub) { setIsFetchingDbUser(false); return; }
      if (contextUser?.isGuest && dbUser && dbUser.name === contextUser.name) { setIsFetchingDbUser(false); return; }
      if (!auth0IsLoading && !auth0User && !contextUser) { setIsFetchingDbUser(false); setDbUser(null); return; }
      
      let query = '';
      if (contextUser?.isGuest) query = `?name=${encodeURIComponent(contextUser.name)}`;
      else if (auth0User?.sub) query = `?auth0Id=${encodeURIComponent(auth0User.sub)}`;
      if (!query) return;

      try {
        setIsFetchingDbUser(true);
        const res = await fetch(`/api/user${query}`);
        const data = await res.json();
        if (res.ok) setDbUser(data.user);
        else setDbUser(null);
      } catch (err) { console.error('Error fetching user:', err); } 
      finally { setIsFetchingDbUser(false); }
    };
    fetchUser();
  }, [contextUser, auth0User, auth0IsLoading, dbUser]);

  // --- HOW TO DIALOG LOGIC ---
  useEffect(() => {
    const hasSeenLocally = localStorage.getItem('howto') === 'seen';
    const hasSeenViaStats = dbUser?.stats && Object.keys(dbUser.stats).length > 0;
    if (!hasSeenLocally && !hasSeenViaStats) setShowHowToDialog(true);
  }, [dbUser]);

  // --- SYNC HANDLER ---
  const handleSync = async () => {
    router.push('/play/sync-matches');
  };

  const handleItemChange = (value: string) => {
    const newItem = selectableItems.find(item => item._id === value);
    if (newItem) {
      setSelectedItem(newItem);
      document.cookie = `lastLocation=${newItem._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }
  };

  return (
    <Box style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '120px' }}>
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } } 
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      <HowToDialog open={showHowToDialog} onOpenChange={setShowHowToDialog}/>

      {/* --- DUPR CONNECTION ERROR DIALOG --- */}
      <Dialog.Root open={duprErrorOpen} onOpenChange={setDuprErrorOpen}>
        <Dialog.Content maxWidth="400px" style={{ borderRadius: '16px' }}>
          <Flex align="center" gap="3" mb="4">
            <Box style={{ backgroundColor: 'var(--red-3)', padding: '8px', borderRadius: '50%' }}>
               <ExclamationTriangleIcon width="24" height="24" color="var(--red-9)" />
            </Box>
            <Dialog.Title style={{ margin: 0 }}>Connection Failed</Dialog.Title>
          </Flex>
          
          <Dialog.Description size="2" color="gray" mb="5" style={{ lineHeight: 1.5 }}>
            {duprErrorMessage}
          </Dialog.Description>

          <Flex justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" style={{ cursor: 'pointer' }}>
                Close
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* --- STICKY HEADER (Matches Example) --- */}
      <Box 
        position="sticky" 
        top="0" 
        style={{ 
          zIndex: 50, 
          backgroundColor: 'rgba(255, 255, 255, 0.8)', 
          backdropFilter: 'blur(12px)', 
          borderBottom: '1px solid var(--slate-a4)' 
        }}
      >
        <Flex 
          justify="between" 
          align="center" 
          px={{ initial: '4', md: '6' }} 
          py="3" 
          style={{ width: '100%', maxWidth: '1024px', margin: '0 auto' }}
        >
          <Flex align="center" gap="2" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <Image src={darkGgLogo} alt="GG Pickleball logo" priority height={32} width={56} style={{ width: 'auto', height: '32px' }} />
          </Flex>

          {authenticationStatus === 'loading' ? (
            <Spinner />
          ) : (
            <Flex align="center" gap="3">
              {authenticationStatus === 'anonymous' && (
                <Button size="2" variant="outline" color="gray" onClick={() => router.push('/auth/login?returnTo=/play')}>
                  Log in
                </Button>
              )}
              
              {(authenticationStatus === 'authenticated' || authenticationStatus === 'guest') && dbUser && (
                <Flex align="center" gap="3">
                  {!isMobile && (
                    <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      {String(dbUser.name).split('@')[0]}
                    </Text>
                  )}
                  <PlayMenu
                    user={dbUser}
                    isAuthorized={true}
                    onUserUpdate={handleUserUpdate}
                    onInitiateDuprLogin={handleInitiateDuprLogin}
                  />
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      </Box>

      {/* DUPR IFRAME (Kept functional overlay) */}
      {showDuprFrame && (
        <Flex 
          style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999, 
            justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' 
          }}
        >
          <div style={{
            width: '90%', maxWidth: '500px', height: '80%', backgroundColor: 'white', 
            position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
          }}>
            <IconButton 
              variant="solid" color="gray" highContrast radius="full" onClick={() => setShowDuprFrame(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 20 }}
            >
              <Cross1Icon width="20" height="20" />
            </IconButton>
            <iframe src={duprConfig.loginUrl} title="DUPR Login" width="100%" height="100%" style={{ border: 'none' }} />
          </div>
        </Flex>
      )}
      
      {/* --- MAIN CONTENT --- */}
      <Box px={{ initial: '4', md: '6' }} py="6" style={{ width: '100%', maxWidth: '1024px', margin: '0 auto' }}>
        
        {selectedItem &&  authenticationStatus !== 'loading' && (
          <>
            {/* --- HERO / CONTEXT CARD (Replaces the basic action bar) --- */}
            <Box 
              position="relative" 
              overflow="hidden" 
              mb="8"
              style={{ 
                borderRadius: '24px', 
                backgroundColor: 'var(--slate-12)', 
                padding: '32px', 
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' 
              }}
            >
              {/* Decorative Blobs */}
              <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '250px', height: '250px', backgroundColor: 'var(--lime-9)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.2 }} />
              <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '250px', height: '250px', backgroundColor: 'var(--cyan-9)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.15 }} />
              
              <Flex direction={{ initial: 'column', sm: 'row' }} justify="between" align={{ initial: 'start', sm: 'end' }} gap="6" position="relative" style={{zIndex: '1'}}>
                
                {/* Left Side: Location Selector */}
                <Box>
                  <Text size="2" mb="2" style={{ color: 'var(--slate-8)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <MapPin size={16} /> Viewing Rewards For
                  </Text>
                  
                  {selectableItems.length > 1 ? (
                    <Select.Root value={selectedItem._id} onValueChange={handleItemChange}>
                      <Select.Trigger variant="ghost" style={{ fontSize: '32px', fontWeight: 'bold', padding: 0, height: 'auto', gap: '12px', color: 'white' }}>
                        <Flex align="center" gap="2">
                          {selectedItem.name}
                          <ChevronDown size={24} opacity={0.5} />
                        </Flex>
                      </Select.Trigger>
                      <Select.Content>
                        {selectableItems.map(item => (
                          <Select.Item key={item._id} value={item._id}>{item.name}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  ) : (
                    <Heading size="8" style={{ color: 'white', letterSpacing: '-0.02em' }}>{selectedItem.name}</Heading>
                  )}
                </Box>

                {/* Right Side: Action Button */}
                {dbUser && dbUser.dupr?.id ? (
                  <Button 
                    size="3"
                    radius="full"
                    onClick={handleSync} 
                    disabled={isDuprSyncing}
                    style={{ 
                      backgroundColor: 'white', 
                      color: 'var(--slate-12)', 
                      cursor: isDuprSyncing ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      padding: '0 24px',
                      height: '48px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <RefreshCw size={18} className={isDuprSyncing ? "spin" : ""} />
                    {isDuprSyncing ? "Syncing..." : "Refresh Rewards"}
                  </Button>
                ) : dbUser && !dbUser.dupr?.id && (
                  <Button 
                    size="3" 
                    radius="full"
                    onClick={handleInitiateDuprLogin}
                    style={{ backgroundColor: 'var(--lime-9)', color: 'var(--slate-12)', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    <LinkIcon size={16} style={{ marginRight: '8px' }} />
                    Connect DUPR To Get Rewards
                </Button>

                )}
              </Flex>
            </Box>
            
            {/* --- REWARDS WALLET --- */}
            <Box mb="8">
              <Flex align="center" justify="between" mb="4">
                <Flex align="center" gap="2">
                  <Trophy size={24} style={{ color: 'var(--lime-10)' }} />
                  <Heading size="6" weight="bold" style={{ color: 'var(--slate-12)', letterSpacing: '-0.01em' }}>
                    Rewards Catalog
                  </Heading>
                </Flex>
              </Flex>
              <GlobalRewardsWallet user={dbUser} dataSourceId={selectedItem._id} />
            </Box>

            {/* --- MATCH HISTORY SECTION --- */}
        {contextUser && selectedItem && (
          <Box mb="8">
            <Flex align="center" justify="between" mb="4">
              <Flex align="center" gap="2">
                <Clock size={24} style={{ color: 'var(--lime-10)' }} />
                <Heading size="6" weight="bold" style={{ color: 'var(--slate-12)', letterSpacing: '-0.01em' }}>
                  Recent Matches
                </Heading>
              </Flex>
            </Flex>
            
            <Card 
              size="2" 
              style={{
                padding: 0, 
                overflow: 'hidden',
                backgroundColor: 'white', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02)', 
                border: '1px solid var(--slate-4)',
                borderRadius: '16px'
              }}
            >
              <Box p={{ initial: '2', md: '4' }}>
                <MatchHistory
                  userId={contextUser.id}
                  userName={contextUser.name}
                  locationId={selectedItem._id}
                />
              </Box>
            </Card>
          </Box>
        )}
          </>
        )}

        
      </Box>
    </Box>
  )
}