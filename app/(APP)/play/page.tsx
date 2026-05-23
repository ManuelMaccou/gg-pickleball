'use client'

import { Box, Button, Flex, Spinner, Text, Card, Heading } from "@radix-ui/themes";
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
import PlayMenu from "@/app/components/PlayMenu";
import GlobalRewardsWallet from "@/components/sections/GlobalRewardsWallet";
// Added Lucide Icons to match the requested design aesthetic
import { Trophy, Clock, MapPin, RefreshCw, ChevronDown, LinkIcon } from "lucide-react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { UpcomingEventsList } from "./components/UpcomingEventsList";
import { DuprConnectModal } from "@/app/components/DuprConnectModal";

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
  const [isFetchingDbUser, setIsFetchingDbUser] = useState(true);

  const [duprModalOpen, setDuprModalOpen] = useState(false);

  // --- AUTH STATUS LOGIC ---
  const authenticationStatus = useMemo(() => {
    if (auth0IsLoading || isFetchingDbUser) return 'loading';
    if (auth0User && dbUser) return 'authenticated';
    if (contextUser?.isGuest && dbUser) return 'guest';
    return 'anonymous';
  }, [auth0IsLoading, isFetchingDbUser, auth0User, dbUser, contextUser]);

  const handleInitiateDuprLogin = () => {
    setDuprModalOpen(true);
  };

  // Called by DuprConnectModal after a successful PATCH — updates local
  // dbUser state immediately so the UI reflects the connected state without
  // a page reload or extra fetch.
  const handleDuprConnected = (updatedUser: FrontendUser) => {
    setDbUser(updatedUser);
  };

  const handleUserUpdate = (updatedUser: FrontendUser | null) => setDbUser(updatedUser);

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

  // --- SYNC HANDLER ---
  const handleSync = async () => {
    router.push('/play/sync-matches');
  };

  return (
    <Box style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '120px' }}>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* DUPR Connect Modal — handles iframe, post-auth screens, and connection errors */}
      <DuprConnectModal
        open={duprModalOpen}
        onOpenChange={setDuprModalOpen}
        onConnected={handleDuprConnected}
      />

      {/* --- STICKY HEADER --- */}
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

      {/* --- MAIN CONTENT --- */}
      <Box px={{ initial: '4', md: '6' }} py="6" style={{ width: '100%', maxWidth: '1024px', margin: '0 auto' }}>

        {selectedItem && authenticationStatus !== 'loading' && (
          <>
            {/* --- HERO / CONTEXT CARD --- */}
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

              <Flex direction={{ initial: 'column', sm: 'row' }} justify="end" align={{ initial: 'start', sm: 'end' }} gap="6" position="relative" style={{ zIndex: '1' }}>


                {/* Right Side: Action Button */}
                {dbUser && dbUser.dupr?.id ? (
                  <Button
                    size="3"
                    radius="full"
                    onClick={handleSync}
                    style={{
                      backgroundColor: 'white',
                      color: 'var(--slate-12)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      padding: '0 24px',
                      height: '48px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    Refresh Rewards
                  </Button>
                ) : dbUser && !dbUser.dupr?.id && (
                  <Flex direction={'column'} gap={'4'}>
                    <Button
                      size="3"
                      radius="full"
                      onClick={handleInitiateDuprLogin}
                      style={{ backgroundColor: 'var(--lime-9)', color: 'var(--slate-12)', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      <LinkIcon size={16} style={{ marginRight: '8px' }} />
                      Connect DUPR To Get Rewards
                    </Button>
                  </Flex>
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

            {/* --- UPCOMING EVENTS --- */}
            <UpcomingEventsList
              dbUser={dbUser}
              authenticationStatus={authenticationStatus}
              onInitiateDuprLogin={handleInitiateDuprLogin}
            />

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