'use client'

import { Box, Button, Flex, Spinner, Text, Heading } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import { Trophy, Clock, RefreshCw, LinkIcon, AlertCircle, RefreshCcw } from "lucide-react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { UpcomingEventsList } from "./components/UpcomingEventsList";
import { DuprConnectModal } from "@/app/components/DuprConnectModal";
import { ReloadIcon } from "@radix-ui/react-icons";

export type SelectableLocation = Omit<IClient, '_id'> & {
  _id: Types.ObjectId | string;
};

// ── Style tokens ──────────────────────────────────────────────────────────────
const LIME = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.1)';
const LIME_BORDER = 'rgba(163,230,53,0.2)';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';
const TEXT_DIM = 'rgba(255,255,255,0.6)';
const TEXT = 'rgba(255,255,255)';
const BORDER = 'rgba(255,255,255,0.08)';

export default function Play() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user: contextUser } = useUserContext();

  const [allClients, setAllClients] = useState<IClient[]>([]);
  const [allDataSources, setAllDataSources] = useState<IDataSource[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [dbUser, setDbUser] = useState<FrontendUser | null>(null);
  const [isFetchingDbUser, setIsFetchingDbUser] = useState(true);
  const [duprModalOpen, setDuprModalOpen] = useState(false);

  // ── Error / loading flags ──────────────────────────────────────────────────
  const [initialDataError, setInitialDataError] = useState(false);
  const [userFetchError, setUserFetchError] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  // ── Auth status ────────────────────────────────────────────────────────────
  const authenticationStatus = useMemo(() => {
    if (auth0IsLoading || isFetchingDbUser) return 'loading';
    if (auth0User && dbUser) return 'authenticated';
    if (contextUser?.isGuest && dbUser) return 'guest';
    return 'anonymous';
  }, [auth0IsLoading, isFetchingDbUser, auth0User, dbUser, contextUser]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInitiateDuprLogin = () => setDuprModalOpen(true);
  const handleDuprConnected = (updatedUser: FrontendUser) => setDbUser(updatedUser);
  const handleUserUpdate = (updatedUser: FrontendUser | null) => setDbUser(updatedUser);
  const handleSync = async () => router.push('/play/sync-matches');

  // ── Initial data fetch ────────────────────────────────────────────────────
  const fetchInitialData = async () => {
    setInitialDataError(false);
    setIsLoadingInitialData(true);
    try {
      const [clientsRes, dataSourcesRes] = await Promise.all([
        fetch('/api/client'),
        fetch('/api/data-source'),
      ]);
      if (!clientsRes.ok) throw new Error(`Clients fetch failed (${clientsRes.status})`);
      const clientsData = await clientsRes.json();
      const dataSourcesData = await dataSourcesRes.json().catch(() => ({ dataSources: [] }));
      setAllClients(clientsData.clients || []);
      setAllDataSources(dataSourcesData.dataSources || []);
    } catch (error) {
      console.error('[Play] Error fetching initial page data:', error);
      setInitialDataError(true);
    } finally {
      setIsLoadingInitialData(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  // ── Selectable items ───────────────────────────────────────────────────────
  const selectableItems = useMemo(() => {
    const isClientSelectable = (client: IClient) =>
      client.active &&
      Array.isArray(client.achievements) &&
      client.achievements.length > 0 &&
      client.rewardsPerAchievement &&
      Object.keys(client.rewardsPerAchievement).length > 0;

    const clientItems: SelectableItem[] = allClients.filter(isClientSelectable).map((client) => ({
      _id: client._id.toString(), name: client.name, displayIcon: client.logo,
      type: 'client', originalData: client,
    }));
    const dataSourceItems: SelectableItem[] = allDataSources.filter(s => s.active).map((source) => ({
      _id: source._id.toString(), name: source.name, displayIcon: source.icon,
      type: 'dataSource', originalData: source,
    }));
    return [...dataSourceItems, ...clientItems];
  }, [allClients, allDataSources]);

  // ── Cookie / selectedItem ──────────────────────────────────────────────────
  useEffect(() => {
    if (selectableItems.length === 0) return;
    const setItemFromCookie = async () => {
      if (selectableItems.length === 1) { setSelectedItem(selectableItems[0]); return; }
      const lastLocationCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('lastLocation='))
        ?.split('=')[1];
      if (lastLocationCookie) {
        const lastItem = selectableItems.find(item => item._id === lastLocationCookie);
        if (lastItem) { setSelectedItem(lastItem); }
        else {
          setSelectedItem(selectableItems[0]);
          document.cookie = `lastLocation=${selectableItems[0]._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
        }
      } else {
        setSelectedItem(selectableItems[0]);
        document.cookie = `lastLocation=${selectableItems[0]._id}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
    };
    setItemFromCookie();
  }, [selectableItems]);

  // ── User fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      setUserFetchError(false);
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
        if (res.ok) {
          setDbUser(data.user);
        } else {
          console.error('[Play] User fetch non-ok:', data);
          setUserFetchError(true);
          setDbUser(null);
        }
      } catch (err) {
        console.error('[Play] User fetch threw:', err);
        setUserFetchError(true);
        setDbUser(null);
      } finally {
        setIsFetchingDbUser(false);
      }
    };
    fetchUser();
  }, [contextUser, auth0User, auth0IsLoading, dbUser]);

  // ── Shopify install detection ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    const hmac = params.get('hmac');
    if (shop && hmac) window.location.href = `/api/shopify/install${window.location.search}`;
  }, []);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isPageLoading =
    isMobile === null ||
    auth0IsLoading ||
    isLoadingInitialData ||
    (authenticationStatus === 'loading' && !initialDataError);

  const noBrandsParticipating =
    !isLoadingInitialData &&
    !initialDataError &&
    selectableItems.length === 0;

  // ── Full-page loading state ────────────────────────────────────────────────
  if (isPageLoading) {
    return (
      <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        {/* Keep the header visible so it doesn't feel blank */}
        <Box style={{
          position: 'sticky', top: 0, zIndex: 50,
          backgroundColor: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: `0.5px solid ${BORDER}`,
        }}>
          <Flex
            justify="between" align="center"
            px={{ initial: '4', md: '6' }} py="3"
            style={{ maxWidth: 1024, margin: '0 auto' }}
          >
            <Image
              src={darkGgLogo}
              alt="GG Pickleball"
              priority height={32} width={56}
              style={{ width: 'auto', height: 32, filter: 'invert(1)' }}
            />
            <Spinner style={{ color: TEXT_MUTED }} />
          </Flex>
        </Box>
        <Flex justify="center" align="center" style={{ height: 'calc(100vh - 64px)' }}>
          <Spinner size="3" style={{ color: LIME }} />
        </Flex>
      </Box>
    );
  }

  // ── Initial data fetch error ───────────────────────────────────────────────
  if (initialDataError) {
    return (
      <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Flex justify="center" align="center" style={{ height: '100vh' }}>
          <Flex direction="column" align="center" gap="5" style={{ maxWidth: 360, textAlign: 'center', padding: '0 24px' }}>
            <Flex align="center" justify="center" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.2)',
            }}>
              <AlertCircle size={24} style={{ color: '#f87171' }} />
            </Flex>
            <Flex direction="column" gap="2">
              <Heading size="5" style={{ color: '#fff' }}>Something went wrong</Heading>
              <Text size="2" style={{ color: TEXT_DIM }}>
                We couldn't load the rewards catalog. This is usually temporary — try refreshing.
              </Text>
            </Flex>
            <Button
              size="3"
              radius="full"
              onClick={fetchInitialData}
              style={{ backgroundColor: LIME, color: '#0a0a0a', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <ReloadIcon style={{ marginRight: 6 }} /> Try Again
            </Button>
          </Flex>
        </Flex>
      </Box>
    );
  }

  // ── User fetch error (logged-in user only) ────────────────────────────────
  // We still render the page, but show an inline notice at the top instead
  // of silently showing them a "Log in" button when they're already logged in.
  const userFetchBanner = userFetchError && (auth0User || contextUser?.isGuest) ? (
    <Box
      px="4" py="3" mb="4"
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: `0.5px solid rgba(239,68,68,0.2)`,
        borderRadius: 12,
      }}
    >
      <Flex align="center" justify="between" gap="4" wrap="wrap">
        <Flex align="center" gap="2">
          <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
          <Text size="2" style={{ color: '#f87171' }}>
            We had trouble loading your profile. Your rewards may not show correctly.
          </Text>
        </Flex>
        <Button
          size="1"
          variant="ghost"
          onClick={() => window.location.reload()}
          style={{ color: '#f87171', cursor: 'pointer', flexShrink: 0 }}
        >
          <RefreshCcw size={12} style={{ marginRight: 4 }} />
          Refresh
        </Button>
      </Flex>
    </Box>
  ) : null;

  return (
    <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', paddingBottom: '120px' }}>
      <DuprConnectModal
        open={duprModalOpen}
        onOpenChange={setDuprModalOpen}
        onConnected={handleDuprConnected}
      />

      {/* ── Sticky header ── */}
      <Box
        position="sticky"
        top="0"
        style={{
          zIndex: 50,
          backgroundColor: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `0.5px solid ${BORDER}`,
        }}
      >
        <Flex
          justify="between" align="center"
          px={{ initial: '4', md: '6' }} py="3"
          style={{ width: '100%', maxWidth: 1024, margin: '0 auto' }}
        >
          <Flex align="center" gap="2" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <Image
              src={darkGgLogo}
              alt="GG Pickleball logo"
              priority height={32} width={56}
              style={{ width: 'auto', height: '32px', filter: 'invert(1)' }}
            />
          </Flex>

          {authenticationStatus === 'loading' ? (
            <Spinner style={{ color: TEXT_MUTED }} />
          ) : (
            <Flex align="center" gap="3">
              {authenticationStatus === 'anonymous' && (
                <Button
                  size="3" 
                  style={{ backgroundColor: 'transparent', borderStyle: "solid", borderColor: '#ffffff', borderWidth: "1px", borderRadius: '20px' , color: TEXT, cursor: 'pointer' }}
                  onClick={() => router.push('/auth/login?returnTo=/play')}
                >
                  Log in
                </Button>
              )}
              {(authenticationStatus === 'authenticated' || authenticationStatus === 'guest') && dbUser && (
                <Flex align="center" gap="3">
                  {!isMobile && (
                    <Text size="2" weight="bold" style={{ color: TEXT_DIM }}>
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

      {/* ── Main content ── */}
      <Box px={{ initial: '4', md: '6' }} py="6" style={{ width: '100%', maxWidth: 1024, margin: '0 auto' }}>

        {/* User fetch error banner — shown inline so page still renders */}
        {userFetchBanner}

        {/* ── No brands participating yet ── */}
        {noBrandsParticipating ? (
          <Flex
            direction="column"
            align="center"
            gap="5"
            style={{
              paddingTop: 80,
              paddingBottom: 80,
              textAlign: 'center',
            }}
          >
            <Flex align="center" justify="center" style={{
              width: 64, height: 64, borderRadius: '50%',
              background: LIME_DIM,
              border: `0.5px solid ${LIME_BORDER}`,
            }}>
              <Trophy size={28} style={{ color: LIME }} />
            </Flex>
            <Flex direction="column" gap="2" style={{ maxWidth: 380 }}>
              <Heading size="6" style={{ color: '#fff' }}>Rewards coming soon</Heading>
              <Text size="3" style={{ color: TEXT_DIM }}>
                Brand partners are being onboarded. Check back soon — rewards will appear here automatically once brands go live.
              </Text>
            </Flex>
          </Flex>
        ) : selectedItem && authenticationStatus !== 'loading' && (
          <>
            {/* ── Hero card ── */}
            <Box
              position="relative"
              overflow="hidden"
              mb="8"
              style={{
                borderRadius: 24,
                background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
                padding: 32,
                border: `0.5px solid ${BORDER}`,
                boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
              }}
            >
              {/* Decorative orbs */}
              <div style={{
                position: 'absolute', top: -60, right: -60,
                width: 260, height: 260,
                background: 'radial-gradient(circle at center, rgba(163,230,53,0.3) 0%, transparent 70%)',
                filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: -60, left: -60,
                width: 220, height: 220,
                background: 'radial-gradient(circle at center, rgba(6,182,212,0.2) 0%, transparent 70%)',
                filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
              }} />

              <Flex direction="column" gap="5" position="relative" style={{ zIndex: 1 }}>
                <Flex
                  direction={{ initial: 'column', sm: 'row' }}
                  justify="between"
                  align={{ initial: 'start', sm: 'center' }}
                  gap="4"
                >
                  <Box>
                    <Text size="1" weight="bold" style={{
                      color: LIME, letterSpacing: '0.12em',
                      textTransform: 'uppercase', display: 'block', marginBottom: 6,
                    }}>
                      Rewards catalog
                    </Text>
                    <Heading size="7" style={{ color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {dbUser
                        ? `Welcome back, ${String(dbUser.name).split('@')[0]}.`
                        : 'Your rewards are waiting.'}
                    </Heading>
                    {dbUser && !dbUser.dupr?.id && (
                      <Text size="2" style={{ color: TEXT_MUTED, marginTop: 6, display: 'block' }}>
                        Connect DUPR to start earning rewards from your matches.
                      </Text>
                    )}
                  </Box>

                  <Box style={{ flexShrink: 0 }}>
                    {dbUser && dbUser.dupr?.id ? (
                      <Button
                        size="3" radius="full" onClick={handleSync}
                        style={{
                          backgroundColor: LIME, color: '#0a0a0a', cursor: 'pointer',
                          fontWeight: 'bold', padding: '0 24px', height: 48,
                          boxShadow: '0 0 24px rgba(163,230,53,0.25)',
                        }}
                      >
                        <RefreshCw size={16} style={{ marginRight: 8 }} />
                        Refresh Rewards
                      </Button>
                    ) : dbUser && !dbUser.dupr?.id ? (
                      <Button
                        size="3" radius="full" onClick={handleInitiateDuprLogin}
                        style={{
                          backgroundColor: LIME, color: '#0a0a0a', fontWeight: 'bold',
                          cursor: 'pointer', padding: '0 24px', height: 48,
                          boxShadow: '0 0 24px rgba(163,230,53,0.25)',
                        }}
                      >
                        <LinkIcon size={16} style={{ marginRight: 8 }} />
                        Connect DUPR To Get Rewards
                      </Button>
                    ) : null}
                  </Box>
                </Flex>

                {/* Stats row */}
                {dbUser && dbUser.dupr?.id && (() => {
                  const statValues = Object.values(dbUser.stats ?? {});
                  const totalWins = statValues.reduce((sum, s) => sum + (s.wins ?? 0), 0);
                  const totalLosses = statValues.reduce((sum, s) => sum + (s.losses ?? 0), 0);
                  const totalMatches = totalWins + totalLosses;
                  const duprRating = dbUser.dupr?.doublesRating ?? dbUser.dupr?.rating ?? null;

                  return (
                    <Flex gap="3">
                      {[
                        { value: duprRating != null ? duprRating.toFixed(2) : '—', label: 'DUPR rating', accent: false },
                        { value: totalWins, label: 'Total wins', accent: true },
                        { value: totalMatches, label: 'Matches', accent: false },
                      ].map(({ value, label, accent }) => (
                        <Box key={label} style={{
                          flex: 1, borderRadius: 10, padding: '10px 14px', textAlign: 'center',
                          background: accent ? LIME_DIM : 'rgba(255,255,255,0.06)',
                          border: accent ? `0.5px solid ${LIME_BORDER}` : `0.5px solid rgba(255,255,255,0.06)`,
                        }}>
                          <Text size="6" weight="bold" style={{
                            display: 'block', color: accent ? LIME : '#fff', lineHeight: 1, marginBottom: 4,
                          }}>
                            {value}
                          </Text>
                          <Text size="1" style={{
                            color: accent ? 'rgba(163,230,53,0.5)' : TEXT_MUTED, letterSpacing: '0.04em',
                          }}>
                            {label}
                          </Text>
                        </Box>
                      ))}
                    </Flex>
                  );
                })()}
              </Flex>
            </Box>

            {/* ── Rewards wallet ── */}
            <Box mb="8">
              <Flex align="center" gap="3" mb="5">
                <Flex align="center" justify="center" style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: LIME_DIM, border: `0.5px solid ${LIME_BORDER}`,
                }}>
                  <Trophy size={18} style={{ color: LIME }} />
                </Flex>
                <Box>
                  <Heading size="5" style={{ color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
                    Rewards Catalog
                  </Heading>
                  <Text size="2" style={{ color: TEXT_MUTED, display: 'block', marginTop: 2 }}>
                    Unlock rewards by hitting win milestones
                  </Text>
                </Box>
              </Flex>
              <GlobalRewardsWallet user={dbUser} dataSourceId={selectedItem._id} />
            </Box>

            {/* ── Upcoming events ── */}
            <UpcomingEventsList
              dbUser={dbUser}
              authenticationStatus={authenticationStatus}
              onInitiateDuprLogin={handleInitiateDuprLogin}
            />

            {/* ── Match history ── */}
            {contextUser && selectedItem && (
              <Box mb="8">
                <Flex align="center" gap="3" mb="5">
                  <Flex align="center" justify="center" style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: LIME_DIM, border: `0.5px solid ${LIME_BORDER}`,
                  }}>
                    <Clock size={18} style={{ color: LIME }} />
                  </Flex>
                  <Box>
                    <Heading size="5" style={{ color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
                      Recent Games
                    </Heading>
                    <Text size="2" style={{ color: TEXT_MUTED, display: 'block', marginTop: 2 }}>
                      Synced from your DUPR account.
                    </Text>
                  </Box>
                </Flex>
                <Box style={{
                  background: '#111', border: `0.5px solid ${BORDER}`,
                  borderRadius: 16, overflow: 'hidden', padding: '12px 16px',
                }}>
                  <MatchHistory
                    userId={contextUser.id}
                    userName={contextUser.name}
                    locationId={selectedItem._id}
                  />
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}