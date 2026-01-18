'use client'

import { Box, Button, Flex, Spinner, Text, Select, Card, Heading, Badge } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import lightGgLogo from '../../../public/logos/gg_logo_white_transparent.png'
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
import { ReloadIcon, ChevronDownIcon, CaretSortIcon } from "@radix-ui/react-icons";
import { checkNewRewards } from "@/app/actions/dupr-action";
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
    const baseUrl = appEnv === 'production' ? 'https://dashboard.dupr.com' : 'https://uat.dupr.gg';
    if (!duprClientId) return { loginUrl: '', origin: '' };
    return { loginUrl: `${baseUrl}/login-external-app/${btoa(duprClientId)}`, origin: baseUrl };
  }, [duprClientId]);

  // --- DUPR LISTENER ---
  useEffect(() => {
    const handleDuprMessage = async (event: MessageEvent) => {
      if (event.origin !== duprConfig.origin) return;
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
          if (!response.ok) throw new Error("Failed to save DUPR info.");
          const updatedUser = await response.json();
          setDbUser(updatedUser); 
        } catch (error) { console.error("Error saving DUPR info:", error); }
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
    if (!dbUser?.dupr?.id) return;
    
    setIsDuprSyncing(true);

    try {
      // Call the NEW route we just created
      const response = await fetch('/api/dupr/player/match-history', {
          method: 'POST'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Sync complete. Processed ${result.count} new matches.`);
        // Optional: Refresh user data to show new stats/rewards immediately
        // fetchUser(); 
      } else {
        console.error("Sync failed:", result.error);
      }
    } catch (e) {
      console.error("Unexpected error during sync", e);
    } finally {
      setIsDuprSyncing(false);
    }
  };

  // --- RENDER HELPERS ---
  const handleItemChange = (value: string) => {
    const newItem = selectableItems.find(item => item._id === value);
    if (newItem) {
      setSelectedItem(newItem);
      document.cookie = `lastLocation=${newItem._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }
  };

  return (
    <Flex direction={'column'} minHeight={'100vh'} p={{ initial: '4', md: '6' }} style={{ paddingBottom: '150px' }}>
      
      {/* --- HEADER --- */}
      <Flex 
        justify={"between"} 
        align={'center'} 
        direction={"row"} 
        pt={"2"} 
        pb={"5"} 
        px={'2'} 
        style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}
      >
        <Flex direction={'column'} position={'relative'} maxWidth={{ initial: '80px', md: '100px' }}>
          <Image src={lightGgLogo} alt="GG Pickleball light logo" priority height={540} width={960} />
        </Flex>

        {authenticationStatus === 'loading' ? (
          <Spinner />
        ) : (
          <Flex direction={'row'} justify={'center'} align={'center'} gap="3">
            {/* Show login if anonymous */}
            {authenticationStatus === 'anonymous' && (
              <Button size={'2'} variant="outline" mt={'1'} onClick={() => router.push('/auth/login?returnTo=/play')}>
                Log in
              </Button>
            )}
            
            {/* User Menu */}
            {(authenticationStatus === 'authenticated' || authenticationStatus === 'guest') && dbUser && (
              <>
                {!isMobile && (
                  <Text size="2" weight="bold" color="gray" style={{marginRight: '8px'}}>
                    {String(dbUser.name).split('@')[0]}
                  </Text>
                )}
                <PlayMenu
                  user={dbUser}
                  isAuthorized={true}
                  onUserUpdate={handleUserUpdate}
                  onInitiateDuprLogin={handleInitiateDuprLogin}
                />
              </>
            )}
          </Flex>
        )}
      </Flex>
      
      {/* --- MAIN CONTENT --- */}
      <Flex 
        direction={'column'} 
        width="100%" 
        style={{ maxWidth: '1000px', margin: '0 auto' }}
      >
        <HowToDialog open={showHowToDialog} onOpenChange={setShowHowToDialog}/>

        {/* DUPR IFRAME */}
        {showDuprFrame && (
          <Flex style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 9999, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{width: '90%', maxWidth: '500px', height: '80%', backgroundColor: 'white', position: 'relative', borderRadius: '8px', overflow: 'hidden'}}>
              <iframe src={duprConfig.loginUrl} title="DUPR Login" width="100%" height="100%" style={{ border: 'none' }}></iframe>
            </div>
          </Flex>
        )}

        {selectedItem && (
          <Flex direction={'column'} mb={'5'} mt={'2'}>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>

            {/* --- ACTION BAR: Location Selector + Sync Button --- */}
            <Flex 
              direction={{ initial: 'column', xs: 'row' }} 
              justify={'between'} 
              align={{ initial: 'start', xs: 'center' }} 
              mb="5" 
              gap="3"
            >
              
              {/* Context Switcher - If multiple items exist */}
              {selectableItems.length > 1 ? (
                <Select.Root value={selectedItem._id} onValueChange={handleItemChange}>
                  <Select.Trigger variant="ghost" style={{ fontSize: 'var(--font-size-6)', fontWeight: 'bold', padding: 0, height: 'auto', gap: '8px' }}>
                    <Flex align="center" gap="2">
                      {selectedItem.name}
                      <CaretSortIcon width="24" height="24" />
                    </Flex>
                  </Select.Trigger>
                  <Select.Content>
                    {selectableItems.map(item => (
                      <Select.Item key={item._id} value={item._id}>{item.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              ) : (
                <Heading size="6">{selectedItem.name}</Heading>
              )}

              {/* Sync Button */}
              {dbUser && dbUser.dupr && dbUser.dupr.id && (
                <Button 
                  variant="soft" 
                  color="gray"
                  onClick={handleSync} 
                  disabled={isDuprSyncing}
                  style={{ cursor: isDuprSyncing ? 'not-allowed' : 'pointer' }}
                >
                  <ReloadIcon className={isDuprSyncing ? "spin" : ""} />
                  {isDuprSyncing ? "Checking..." : "Refresh Rewards"}
                </Button>
              )}
            </Flex>
            
            {/* --- REWARDS WALLET --- */}
            {/* The child handles its own Grid/Stack layout */}
            <GlobalRewardsWallet user={dbUser} dataSourceId={selectedItem._id} />
          </Flex>
        )}

        {/* --- MATCH HISTORY SECTION --- */}
        {contextUser && selectedItem && (
          <Flex direction={'column'} mb={'5'} mt={'6'}>
            <Heading size={'4'} mb="3" color="gray">Activity History</Heading>
            
            <Card 
              size="2" 
              style={{
                padding: 0, // Reset padding so MatchHistory can control it
                overflow: 'hidden'
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
          </Flex>
        )}
      </Flex>
    </Flex>
  )
}