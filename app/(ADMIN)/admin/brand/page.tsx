'use client';

import { useEffect, useState } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge, Button, Callout, Card, Flex, Spinner, Table, Text,
  Grid, Avatar, Box, Heading,
} from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Link2Icon, TicketIcon, TrophyIcon, CheckCircle2, Users } from 'lucide-react';
import { DateTime } from 'luxon';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminOnboardingChecklist } from '@/app/components/AdminOnboardingChecklist';
import { RewardCardCustomizer } from '../components/RewardCardCustomizer';
import { BrandPageShell } from '../components/BrandPageShell';
import { MarketingExportCard } from '../components/MarketingExportCard';

interface BrandDashboardStats {
  uniquePlayerCount: number;
  topPlayers: { name: string; winCount: number }[];
}

interface BrandRewardEntry {
  _id: string;
  playerName: string;
  playerEmail: string;
  rewardName: string;
  rewardProduct?: string;
  achievementName?: string;
  code: string;
  earnedAt: string;
  redeemed: boolean;
  redemptionDate?: string;
}

const formatDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '—';
  if (typeof dateInput === 'string') return DateTime.fromISO(dateInput).toFormat('MMM d, yyyy');
  if (dateInput instanceof Date) return DateTime.fromJSDate(dateInput).toFormat('MMM d, yyyy');
  return '—';
};

const StatCard = ({
  title, value, icon, loading,
}: {
  title: string; value: string | number; icon: React.ReactNode; loading?: boolean;
}) => (
  <Card size="2">
    <Flex align="center" gap="3">
      <Flex align="center" justify="center" style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'rgba(132,204,22,0.1)', border: '0.5px solid rgba(132,204,22,0.2)',
        color: '#65a30d', flexShrink: 0,
      }}>
        {icon}
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="2" color="gray">{title}</Text>
        {loading ? <Spinner /> : (
          <Text size="6" weight="bold" style={{ lineHeight: 1 }}>{value}</Text>
        )}
      </Flex>
    </Flex>
  </Card>
);

const CodeBadge = ({ code }: { code: string }) => (
  <Text style={{
    fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px',
    backgroundColor: 'var(--gray-3)', padding: '4px 8px',
    borderRadius: '4px', fontSize: '0.85rem',
  }}>
    {code}
  </Text>
);

export default function BrandAdminDashboard() {
  const { user } = useUserContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const userId = user?.id;
  const { isLoading: auth0IsLoading } = useAuth0User();

  const [location, setLocation] = useState<IClient | null>(null);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);

  const [stats, setStats] = useState<BrandDashboardStats | null>(null);
  const [rewards, setRewards] = useState<BrandRewardEntry[]>([]);
  const [totalRewardsCount, setTotalRewardsCount] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [shopifyStatusReason, setShopifyStatusReason] = useState<string | null>(null);

  const [isGettingAdmin, setIsGettingAdmin] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  // True while we're confirming a plan_handle param — blocks render until resolved
  // so the checklist never flashes the wrong state on first load after plan selection.
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasPlanHandle = !!new URLSearchParams(window.location.search).get('plan_handle');
    console.log('[BrandDashboard] isConfirmingPlan init — plan_handle present:', hasPlanHandle, 'URL:', window.location.search);
    return hasPlanHandle;
  });

  const [confirmPlanError, setConfirmPlanError] = useState(false);

  const [statsError, setStatsError] = useState<string | null>(null);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  const [showCardCustomizer, setShowCardCustomizer] = useState(false);

  const [shopifyStatus, setShopifyStatus] = useState<
    'unknown' | 'connected' | 'disconnected' | 'check_failed'
  >('unknown');
  const [shopifyStatusDismissed, setShopifyStatusDismissed] = useState(false);

  const handleClientUpdated = (updates: {
    cardBackgroundImage?: string; cardTextColor?: string; logo?: string;
  }) => {
    setLocation((prev) => (prev ? ({ ...prev, ...updates } as IClient) : null));
  };

  // ── Effect 1: Get admin + redirect if no permissions ──
  useEffect(() => {
    if (!userId) return;
    const getAdminUser = async () => {
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);
        if (response.status === 204 || response.status === 401 || response.status === 403) {
          setIsRedirecting(true);
          router.replace('/error?reason=no_admin_permissions');
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error('[BrandDashboard] Admin fetch failed:', data);
          setIsRedirecting(true);
          router.replace('/error?reason=unknown');
          return;
        }
        const data = await response.json();

        // Approved application exists but Admin/Client setup never completed.
        if (data.setupIncomplete) {
          const { brandName, email, legalCompanyName, id } = data.application;
          const subject = `Brand dashboard setup issue — ${brandName}`;
          const body = [
            `Hi GG Pickleball team,`,
            ``,
            `My brand application was approved, but I can't access my dashboard.`,
            ``,
            `Brand: ${brandName}`,
            `Legal company name: ${legalCompanyName}`,
            `Email: ${email}`,
            `Application ID: ${id}`,
            ``,
            `Please investigate. Thanks!`,
          ].join('\n');

          setIsRedirecting(true);
          router.replace(
            `/error?reason=approved_setup_incomplete` +
            `&mailtoSubject=${encodeURIComponent(subject)}` +
            `&mailtoBody=${encodeURIComponent(body)}`
          );
          return;
        }

        if (data.admin.permission) setAdminPermission(data.admin.permission);
        setLocation(data.location);
      } catch (error) {
        console.error('[BrandDashboard] Unexpected error fetching admin:', error);
        setIsRedirecting(true);
        router.replace('/error?reason=unknown');
      } finally {
        setIsGettingAdmin(false);
      }
    };
    getAdminUser();
  }, [userId, router]);

  // ── Effect 2: Shopify status check ──
  useEffect(() => {
    if (!location) return;

    // accessToken is stripped from /api/admin for security — check shopDomain
    // only to determine if Shopify was ever connected. The live status check
    // confirms whether the connection is still valid.
    const isShopifyConnectedInDB = !!(
      location.retailSoftware === 'shopify' &&
      location.shopify?.shopDomain
    );

    if (!isShopifyConnectedInDB) { setShopifyStatus('disconnected'); return; }

    const checkConnection = async () => {
      try {
        const res = await fetch('/api/brand/shopify-status');
        const data = await res.json();
        if (!res.ok) { setShopifyStatus('check_failed'); return; }
        if (data.connected) {
          setShopifyStatus('connected');
          setLocation((prev) =>
            prev ? ({
              ...prev,
              shopify: {
                ...prev.shopify,
                hasActivePlan: data.hasActivePlan ?? prev.shopify?.hasActivePlan,
                // accessToken is stripped from /api/admin for security. Use a
                // sentinel value so the checklist knows Shopify is connected
                // without the real token ever reaching the client.
                accessToken: prev.shopify?.accessToken || 'connected',
              }
            } as unknown as IClient) : null
          );
        } else {
          setShopifyStatus('disconnected');
          setShopifyStatusReason(data.reason ?? null);
          setLocation((prev) =>
            prev ? ({ ...prev, shopify: { ...prev.shopify, accessToken: undefined } } as unknown as IClient) : null
          );
        }
      } catch {
        setShopifyStatus('check_failed');
      }
    };
    checkConnection();
  }, [location?._id]);

  // ── Effect 3: Fetch stats ──
  useEffect(() => {
    if (!location) return;
    const getBrandStats = async () => {
      setIsLoadingStats(true);
      setStatsError(null);
      try {
        const response = await fetch(`/api/brand/player-stats?clientId=${location._id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setStats({ uniquePlayerCount: data.uniquePlayerCount, topPlayers: data.topPlayers });
      } catch (error) {
        console.error('[BrandDashboard] Failed to fetch stats:', error);
        setStatsError('Unable to load stats. Please refresh and try again.');
      } finally {
        setIsLoadingStats(false);
      }
    };
    getBrandStats();
  }, [location?._id]);

  // ── Effect 4: Fetch rewards ──
  useEffect(() => {
    if (!location) return;
    const getBrandRewards = async () => {
      setIsLoadingRewards(true);
      setRewardsError(null);
      try {
        const response = await fetch(
          `/api/brand/rewards?clientId=${location._id}&page=${page}&limit=20`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRewards(data.rewards);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRewardsCount(data.pagination?.total || 0);
      } catch (error) {
        console.error('[BrandDashboard] Failed to fetch rewards:', error);
        setRewardsError('Unable to load rewards. Please refresh and try again.');
      } finally {
        setIsLoadingRewards(false);
      }
    };
    getBrandRewards();
  }, [location?._id, page]);

  // ── Effect 5: Auto-open card customizer ──
  useEffect(() => {
    if (!isLoadingRewards) setShowCardCustomizer(totalRewardsCount === 0);
  }, [isLoadingRewards, totalRewardsCount]);

  // ── Effect 6: Auth redirect ──
  useEffect(() => {
    if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/brand');
  }, [auth0IsLoading, user, router]);

  // ── Effect 7: Shopify install detection ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    const hmac = params.get('hmac');
    if (shop && hmac) window.location.href = `/api/shopify/install${window.location.search}`;
  }, []);

  // ── Effect 8: Confirm plan when redirected back from Shopify pricing page ──
  // After plan selection, Shopify redirects to /admin/brand?plan_handle=...
  // The callback never sees this param. We call confirm-plan immediately,
  // update local state, and only then release the loading gate so the checklist
  // never renders with the wrong plan state.
  useEffect(() => {
    const planHandle = searchParams.get('plan_handle');
    if (!planHandle || !location) return;

    const confirmPlan = async () => {
      try {
        console.log('[BrandDashboard] plan_handle detected:', planHandle, '— confirming plan');
        console.log('[BrandDashboard] Current URL:', window.location.href);
        console.log('[BrandDashboard] location._id:', location?._id, 'hasActivePlan in state:', (location as any)?.shopify?.hasActivePlan);
        const res = await fetch('/api/brand/confirm-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planHandle }),
        });
        if (res.ok) {
          console.log('[BrandDashboard] Plan confirmed — updating local state');
          setLocation((prev) =>
            prev
              ? ({ ...prev, shopify: { ...prev.shopify, hasActivePlan: true, planHandle } } as unknown as IClient)
              : null
          );
        } else {
          console.error('[BrandDashboard] confirm-plan failed:', await res.json());
          setConfirmPlanError(true);
        }
      } catch (err) {
        console.error('[BrandDashboard] confirm-plan error:', err);
        setConfirmPlanError(true);
      } finally {
        // Always release the gate — even if confirm-plan failed, don't leave
        // the page stuck in a loading state.
        setIsConfirmingPlan(false);
      }
    };

    confirmPlan();
  }, [searchParams, location?._id]);

  // If no plan_handle in URL, the confirming gate isn't needed — release it.
  useEffect(() => {
    const planHandle = searchParams.get('plan_handle');
    console.log('[BrandDashboard] searchParams effect — plan_handle:', planHandle ?? 'none');
    if (!planHandle) setIsConfirmingPlan(false);
  }, [searchParams]);

  const isShopifyConnected = !!(
    location?.retailSoftware === 'shopify' &&
    location?.shopify?.shopDomain &&
    location?.shopify?.accessToken &&
    location?.shopify?.hasActivePlan
  );

  // Loading gate — includes isConfirmingPlan so the checklist never flashes
  // the wrong state when landing from Shopify's plan selection redirect.
  if (isMobile === null || auth0IsLoading || isGettingAdmin || isConfirmingPlan || isRedirecting) {
    return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  }

  return (
    <BrandPageShell adminPermission={adminPermission} location={location}>

      <Flex justify="between" align="center">
        <Heading size="6">Dashboard</Heading>
        <Flex align="center" gap="3">
          {location?.retailSoftware === 'shopify' && (
            <Button
              size="2"
              variant={isShopifyConnected ? 'soft' : 'outline'}
              color={isShopifyConnected ? 'green' : 'gray'}
              style={{ cursor: 'pointer', fontWeight: 500 }}
              onClick={() => router.push('/admin/brand/connect-shopify')}
            >
              {isShopifyConnected
                ? <><CheckCircle2 size={16} /> Shopify Active</>
                : <><Link2Icon size={16} /> Connect Shopify</>}
            </Button>
          )}
          {location && (
            <Badge size="2" color="gray" variant="surface">{location.name}</Badge>
          )}
        </Flex>
      </Flex>

      {shopifyStatus === 'disconnected' &&
        shopifyStatusReason === 'uninstalled' &&
          !shopifyStatusDismissed && (
            <Callout.Root color="amber" size="2">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Flex justify="between" align="center" gap="4" wrap="wrap" style={{ flex: 1 }}>
                <Callout.Text>
                  Your Shopify connection has been lost. This can happen if the app was
                  uninstalled or access was revoked. Reconnect to restore full functionality.
                </Callout.Text>
                <Flex gap="3" align="center" style={{ flexShrink: 0 }}>
                  <Button size="2" color="amber" variant="solid"
                    onClick={() => router.push('/admin/brand/connect-shopify')}>
                    Reconnect Shopify
                  </Button>
                  <Button size="2" variant="ghost" color="gray"
                    onClick={() => setShopifyStatusDismissed(true)}>
                    Dismiss
                  </Button>
                </Flex>
              </Flex>
            </Callout.Root>
          )}

      {shopifyStatus === 'disconnected' &&
        shopifyStatusReason === 'no_plan' && (
          <Callout.Root color="amber" size="2">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Flex justify="between" align="center" gap="4" wrap="wrap" style={{ flex: 1 }}>
              <Callout.Text>
                Your Shopify store is connected but no active plan is selected.
                Choose a plan to start issuing rewards.
              </Callout.Text>
              <Button size="2" color="amber" variant="solid"
                onClick={() => router.push('/admin/brand/connect-shopify')}>
                Select a Plan
              </Button>
            </Flex>
          </Callout.Root>
        )}

      {shopifyStatus === 'check_failed' && (
        <Callout.Root color="red" size="2">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            We couldn't verify your Shopify connection. Please refresh the page.
            If this continues, try reconnecting your store.
          </Callout.Text>
        </Callout.Root>
      )}

      {confirmPlanError && (
        <Callout.Root color="amber" size="2">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            Your plan was selected but we couldn't confirm it. Please refresh the page.
          </Callout.Text>
        </Callout.Root>
      )}

      {user && location && (
        <AdminOnboardingChecklist
          user={user}
          client={location}
          hasRewards={!!location.hasConfiguredRewards}
          totalRewardsIssued={totalRewardsCount}
          onClientUpdated={handleClientUpdated}
        />
      )}

      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <StatCard title="Players Engaged" value={stats?.uniquePlayerCount ?? 0} loading={isLoadingStats} icon={<Users size={18} />} />
        <StatCard title="Rewards Issued" value={totalRewardsCount} loading={isLoadingRewards} icon={<TicketIcon size={18} />} />
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="6">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Box px="4" py="3" style={{ borderBottom: '1px solid var(--gray-a4)' }}>
              <Heading size="4">Reward Log</Heading>
              <Text size="2" color="gray">Players who've earned a reward from your brand</Text>
            </Box>

            {rewardsError && (
              <Callout.Root color="red" m="4"><Callout.Text>{rewardsError}</Callout.Text></Callout.Root>
            )}

            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Reward</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Unlocked Via</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {isLoadingRewards ? (
                  <Table.Row>
                    <Table.Cell colSpan={5}><Flex justify="center" p="4"><Spinner /></Flex></Table.Cell>
                  </Table.Row>
                ) : rewards.length > 0 ? (
                  rewards.map((entry) => (
                    <Table.Row key={entry._id}>
                      <Table.RowHeaderCell>
                        <Flex gap="3" align="center">
                          <Avatar size="1" fallback={entry.playerName.charAt(0)} radius="full" />
                          <Text size="2" weight="medium">{entry.playerName}</Text>
                        </Flex>
                      </Table.RowHeaderCell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Text size="2">{entry.rewardName}</Text>
                          <Flex gap="2" align="center">
                            <CodeBadge code={entry.code} />
                            {entry.rewardProduct && <Text size="1" color="gray">({entry.rewardProduct})</Text>}
                          </Flex>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell><Text size="2" color="gray">{entry.achievementName || '—'}</Text></Table.Cell>
                      <Table.Cell>
                        {entry.redeemed
                          ? <Badge color="green" radius="full">Redeemed</Badge>
                          : <Badge color="amber" radius="full">Active</Badge>}
                      </Table.Cell>
                      <Table.Cell><Text size="2" color="gray">{formatDate(entry.earnedAt)}</Text></Table.Cell>
                    </Table.Row>
                  ))
                ) : (
                  <Table.Row>
                    <Table.Cell colSpan={5}><Text color="gray" align="center" my="4">No rewards issued yet.</Text></Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>

            <Flex justify="between" align="center" p="3"
              style={{ borderTop: '1px solid var(--gray-a4)', backgroundColor: 'var(--gray-2)' }}>
              <Text size="1" color="gray">Page {page} of {totalPages}</Text>
              <Flex gap="2">
                <Button variant="soft" color="gray" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeftIcon /> Prev
                </Button>
                <Button variant="soft" color="gray" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next <ChevronRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Card>
        </Box>

        <Flex direction="column">
          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Box px="4" py="3" style={{ borderBottom: '1px solid var(--gray-a4)' }}>
              <Heading size="4">Top Players</Heading>
              <Text size="2" color="gray">By match wins</Text>
            </Box>
            <Box p="2">
              {isLoadingStats ? (
                <Flex justify="center" p="4"><Spinner /></Flex>
              ) : stats && stats.topPlayers.length > 0 ? (
                <Flex direction="column">
                  {stats.topPlayers.map((player, idx) => (
                    <Flex key={idx} justify="between" align="center" px="2" py="2"
                      style={{ borderBottom: idx < stats.topPlayers.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                      <Flex gap="3" align="center">
                        <Text size="2" color="gray" style={{ width: '20px' }}>#{idx + 1}</Text>
                        <Avatar size="1" fallback={player.name.charAt(0)} radius="full" />
                        <Text size="2" weight="medium">{player.name}</Text>
                      </Flex>
                      <Flex gap="2" align="center">
                        {idx === 0 && <TrophyIcon color="gold" size={14} />}
                        <Text size="2" weight="bold">{player.winCount}</Text>
                        <Text size="1" color="gray">wins</Text>
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
              ) : (
                <Text color="gray" size="2" align="center" my="4">No player data yet.</Text>
              )}
            </Box>
          </Card>
        </Flex>
      </Grid>

      <MarketingExportCard />

      <Box>
        <Flex align="center" gap="4" mb="1">
          <Heading size="4">Reward Card</Heading>
          <Button variant="soft" color={showCardCustomizer ? 'red' : 'blue'} size="2"
            onClick={() => setShowCardCustomizer((v) => !v)}>
            {showCardCustomizer ? 'Hide' : 'Show'}
          </Button>
        </Flex>

        {!showCardCustomizer && (
          <Text size="2" color="gray" mb="4">
            Customize the background image, logo, and text color shown on your reward cards.
          </Text>
        )}

        {showCardCustomizer && location && (
          <>
            <Text size="2" color="gray" mb="4">
              Customize the background image, logo, and text color shown on your reward cards.
            </Text>
            <Card size="3">
              <RewardCardCustomizer
                key={`${location.cardBackgroundImage}-${location.cardTextColor}`}
                clientId={location._id.toString()}
                currentBackgroundImage={location.cardBackgroundImage}
                currentTextColor={location.cardTextColor}
                currentLogo={location.logo}
                onSaved={handleClientUpdated}
              />
            </Card>
          </>
        )}
      </Box>

    </BrandPageShell>
  );
}