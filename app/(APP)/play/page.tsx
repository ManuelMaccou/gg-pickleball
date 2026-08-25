'use client'

// Destination: app/play/page.tsx
//
// [Prominence change] Check-eligibility moved from its own full grid
// section into the hero itself — top-right, next to the heading, the same
// slot the old hidden Connect DUPR/Refresh button used to occupy. Reasoning:
// the underlying check is fully global (every match in the last 6 months,
// not scoped to any one tournament), so presenting it as a per-tournament-
// card action was misleading about what it actually does. The old
// TournamentEligibilityGrid section is replaced with a simpler, button-free
// "Participating Tournaments" browse list using the plain TournamentCards
// grid — informational only now, no per-card action implying false
// scoping. TournamentEligibilityGrid.tsx is fully superseded — delete it,
// nothing references it anymore.

import { Box, Button, Flex, Spinner, Text, Heading, Grid, Separator } from "@radix-ui/themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import darkGgLogo from '../../../public/logos/gg_logo_black_transparent.png'
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useEffect, useMemo, useState } from 'react';
import { FrontendUser } from '@/app/types/frontendTypes';
import MatchHistory from "@/components/sections/MatchHistory";
import PlayMenu from "@/app/components/PlayMenu";
import GlobalRewardsWallet from "@/components/sections/GlobalRewardsWallet";
import { Trophy, Clock, AlertCircle, RefreshCcw, CalendarDays } from "lucide-react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { UpcomingEventsList } from "./components/UpcomingEventsList";
import { DuprConnectModal } from "@/app/components/DuprConnectModal";
import TournamentCards from "../components/TournamentCards";
import CheckEligibilityPanel from "./components/CheckEligibilityPanel";
import { color } from "motion/react";

// ── Style tokens ──────────────────────────────────────────────────────────────
const LIME = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.1)';
const LIME_BORDER = 'rgba(163,230,53,0.2)';
const TEXT_MUTED = 'rgba(255,255,255,0.4)';
const TEXT_DIM = 'rgba(255,255,255,0.6)';
const TEXT = 'rgba(255,255,255)';
const BORDER = 'rgba(255,255,255,0.08)';

// ── Shared section header — was repeated inline 4x, now one component ──────────
function SectionHeader({
  icon, title, description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Flex align="center" gap="3" mb="5">
      <Flex align="center" justify="center" style={{
        width: 36, height: 36, borderRadius: 10,
        background: LIME_DIM, border: `0.5px solid ${LIME_BORDER}`,
      }}>
        {icon}
      </Flex>
      <Flex direction="column" gap="2">
        <Heading size="5" style={{ color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
          {title}
        </Heading>
        <Text size="2" style={{ color: TEXT_MUTED, display: 'block', marginTop: 2 }}>
          {description}
        </Text>
      </Flex>
    </Flex>
  );
}

export default function Play() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user: contextUser } = useUserContext();

  const [dbUser, setDbUser] = useState<FrontendUser | null>(null);
  const [isFetchingDbUser, setIsFetchingDbUser] = useState(true);
  const [duprModalOpen, setDuprModalOpen] = useState(false);

  // ── Error / loading flags ──────────────────────────────────────────────────
  const [userFetchError, setUserFetchError] = useState(false);

  // [Eligibility check] Bumped whenever a check-eligibility call actually
  // processes a match — forces GlobalRewardsWallet to remount and re-fetch.
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

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
    authenticationStatus === 'loading';

  // ── Full-page loading state ────────────────────────────────────────────────
  if (isPageLoading) {
    return (
      <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
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

          <Flex align="center" gap="3">
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
        </Flex>
      </Box>

      <Box px={{ initial: '4', md: '6' }} pt="6" style={{ width: '100%', maxWidth: 1300, margin: '0 auto' }}>

        {userFetchBanner}

        {/* ── Row 1: Hero (2/3) + CheckEligibilityPanel (1/3) ── */}
        <Grid columns={{ initial: '1', md: '3' }} gap={{initial: "0" , md: '5'}} mb="8">
          <Box
            position="relative"
            overflow="hidden"
            mb="8"
            style={{
              gridColumn: 'span 2',
              borderRadius: 24,
              background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
              padding: 32,
              border: `0.5px solid ${BORDER}`,
              boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
            }}
          >
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

              <Flex direction="column" justify="between" height="100%" gap="5" position="relative" style={{ zIndex: 1 }}>
                <Box>
                  <Heading size="7" style={{ color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {dbUser
                      ? `Welcome back, ${String(dbUser.name).split('@')[0]}.`
                      : 'Your rewards are waiting.'}
                  </Heading>
                  {dbUser && !dbUser.dupr?.id && (
                    <Text size="2" style={{ color: TEXT_MUTED, marginTop: 6, display: 'block' }}>
                      Connect DUPR to check your match history and start earning rewards.
                    </Text>
                  )}
                </Box>

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
            <Text align={'right'} size="2" style={{ color: TEXT_MUTED, marginTop: 6, display: 'block' }}>
              Win/match stats from participating tournament data
            </Text>
          </Box>

          <CheckEligibilityPanel
            dbUser={dbUser}
            onInitiateDuprLogin={handleInitiateDuprLogin}
            onRewardsMayHaveChanged={() => setWalletRefreshKey((k) => k + 1)}
          />
        </Grid>
      </Box>

      {/* ── Row 2: Rewards Catalog, full width ── */}
      <Box px={{ initial: '4', md: '6' }} pb="6" style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Box mb="8">
          <SectionHeader
            icon={<Trophy size={18} style={{ color: LIME }} />}
            title="Rewards Catalog"
            description="Unlock rewards by hitting win milestones"
          />
          <GlobalRewardsWallet key={walletRefreshKey} user={dbUser} />
        </Box>

        {/* ── Participating tournaments — informational browse list now,
              no per-card action. The actual eligibility check lives in the
              hero above, since it's not scoped to any one tournament. ── */}
        <Box mb="8">
          <SectionHeader
            icon={<CalendarDays size={18} style={{ color: LIME }} />}
            title="Participating Tournaments"
            description="Play in one of these and any rewards you've earned will be waiting"
          />
          <TournamentCards />
        </Box>

        <UpcomingEventsList
          dbUser={dbUser}
          authenticationStatus={authenticationStatus}
          onInitiateDuprLogin={handleInitiateDuprLogin}
        />

        {/*
        {contextUser && (
          <Box mb="8">
            <SectionHeader
              icon={<Clock size={18} style={{ color: LIME }} />}
              title="Recent Games"
              description="Every match on file for your account"
            />
            <Box style={{
              background: '#111', border: `0.5px solid ${BORDER}`,
              borderRadius: 16, overflow: 'hidden', padding: '12px 16px',
            }}>
              <MatchHistory
                userId={contextUser.id}
                userName={contextUser.name}
              />
            </Box>
          </Box>
        )}
        */}
      </Box>
    </Box>
  );
}