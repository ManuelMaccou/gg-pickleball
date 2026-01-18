'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { 
  Badge, Button, Callout, Card, Flex, Spinner, Table, Text, 
  Grid, Avatar, Box, Heading, Separator 
} from "@radix-ui/themes";
import { 
  CheckCircledIcon,
  ChevronLeftIcon, ChevronRightIcon, 
  PersonIcon 
} from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png'
import { AdminPermissionType, IClient } from "@/app/types/databaseTypes";
import Link from "next/link";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { DateTime } from "luxon";
import MobileMenu from "../components/MobileMenu";
import { Link2Icon, TicketIcon, TrophyIcon } from "lucide-react";

// --- TYPES ---
interface BrandDashboardStats {
  uniquePlayerCount: number;
  topPlayers: {
    name: string;
    winCount: number;
  }[];
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
  if (typeof dateInput === 'string') {
    return DateTime.fromISO(dateInput).toFormat('MMM d, yyyy');
  } else if (dateInput instanceof Date) {
    return DateTime.fromJSDate(dateInput).toFormat('MMM d, yyyy');
  }
  return '—';
};

// --- COMPONENTS ---

const StatCard = ({ title, value, icon, loading }: { title: string, value: string | number, icon: React.ReactNode, loading?: boolean }) => (
  <Card size="2">
    <Flex justify="between" align="start">
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium" color="gray">{title}</Text>
        {loading ? <Spinner /> : <Text size="6" weight="bold">{value}</Text>}
      </Flex>
      <Box style={{ backgroundColor: 'var(--gray-3)', padding: '8px', borderRadius: '50%', color: 'var(--gray-11)' }}>
        {icon}
      </Box>
    </Flex>
  </Card>
);

const CodeBadge = ({ code }: { code: string }) => (
  <Text style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', backgroundColor: 'var(--gray-3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>
    {code}
  </Text>
);

export default function BrandAdminDashboard() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const userId = user?.id;
  const userName = user?.name;
  
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  
  const [location, setLocation] = useState<IClient | null>(null);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  
  const [stats, setStats] = useState<BrandDashboardStats | null>(null);
  const [rewards, setRewards] = useState<BrandRewardEntry[]>([]);
  const [totalRewardsCount, setTotalRewardsCount] = useState<number>(0);
  
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  
  const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [isLoadingRewards, setIsLoadingRewards] = useState<boolean>(true);

  const [adminError, setAdminError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  // 1. Get Admin User
  useEffect(() => {
    if (!userId) return;
    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);
        if (response.status === 204) {
          setAdminError("Access Denied");
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        if (data.admin.permission) setAdminPermission(data.admin.permission);
        setLocation(data.admin.location);
      } catch (error: unknown) {
        setAdminError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsGettingAdmin(false);
      }
    };
    getAdminUser();
  }, [userId]);

  // 2. Fetch Stats
  useEffect(() => {
    console.log('location:', location)
    if (!location) return;
    const getBrandStats = async () => {
      setIsLoadingStats(true);
      setStatsError(null);
      try {
        const response = await fetch(`/api/brand/player-stats?clientId=${location._id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setStats({
          uniquePlayerCount: data.uniquePlayerCount,
          topPlayers: data.topPlayers
        });
      } catch (error) {
        setStatsError(error instanceof Error ? error.message : "Error");
      } finally {
        setIsLoadingStats(false);
      }
    };
    getBrandStats();
  }, [location]);

  useEffect (() => {
    console.log('stats:', stats)
  }, [stats])

  // 3. Fetch Rewards
  useEffect(() => {
    if (!location) return;
    const getBrandRewards = async () => {
      setIsLoadingRewards(true);
      setRewardsError(null);
      try {
        const response = await fetch(`/api/brand/rewards?clientId=${location._id}&page=${page}&limit=20`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setRewards(data.rewards);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRewardsCount(data.pagination?.total || 0);
      } catch (error) {
        setRewardsError(error instanceof Error ? error.message : "Error");
      } finally {
        setIsLoadingRewards(false);
      }
    };
    getBrandRewards();
  }, [location, page]);

  useEffect(() => {
    if (!auth0IsLoading && !user) router.push(`/auth/login?returnTo=/admin/brand`);
  }, [auth0IsLoading, user, router]);

  const isShopifyConnected = location?.retailSoftware === 'shopify' && 
    location?.shopify?.shopDomain &&
    location?.shopify?.accessToken;

  if (isMobile === null || isGettingAdmin) return <Flex justify="center" align="center" height="100vh"><Spinner size="3"/></Flex>;
  if (adminError) return <Flex justify="center" p="9"><Text color="red">{adminError}</Text></Flex>;

  return (
    <Flex direction={'column'} style={{ backgroundColor: "#F9FAFB", minHeight: "100vh" }}>

      {/* --- HEADER --- */}
      <Flex 
        justify={"between"} 
        align={'center'} 
        height={'64px'} 
        px={{initial: '3', md: '6'}} 
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}
      >
        <Flex align="center" gap="4">
          <Image src={darkGgLogo} alt="Logo" height={32} width={60} style={{ objectFit: 'contain' }} />
          <Separator orientation="vertical" style={{ height: '20px' }} />
          <Text weight="bold" size="3">Overview</Text>
        </Flex>

        {!auth0IsLoading && (
          <Flex align={'center'} gap="3">
            {!isMobile && (
               <Text size={'2'} color="gray">
                 {userName ? (auth0User ? `Welcome ${String(userName).split('@')[0]}` : userName) : ''}
               </Text>
            )}
            {isMobile && adminPermission === 'admin' && <MobileMenu />}
            {!isMobile && <Avatar size="2" fallback={userName?.charAt(0).toUpperCase() || 'A'} radius="full" />}
          </Flex>
        )}
      </Flex>
       
      <Flex direction={'row'} style={{ height: 'calc(100vh - 64px)' }}>
        
        {/* --- SIDEBAR (Desktop) --- */}
        {!isMobile && adminPermission === 'admin' && (
          <Flex direction={'column'} width={'180px'} py={'4'} px={'3'} style={{ backgroundColor: 'white', borderRight: '1px solid var(--gray-4)' }}>
            <Flex direction={'column'} gap={'1'}>
              <Link href={'/admin/brand'}>
                <Button variant="ghost" color="gray" style={{ width: '100%', justifyContent: 'start', textDecoration: 'underline' }}>Dashboard</Button>
              </Link>
              <Link href={'/admin/brand/rewards'}>
                <Button variant="ghost" color="gray" style={{ width: '100%', justifyContent: 'start' }}>Configure rewards</Button>
              </Link>
            </Flex>
          </Flex>
        )}

        {/* --- MAIN CANVAS --- */}
        <Flex direction={'column'} flexGrow={'1'} overflowY={'auto'} p={{ initial: '4', md: '6' }} gap={'6'}>
          
          <Flex justify="between" align="center">
            <Heading size="6">Performance Overview</Heading>
            <Flex align={'center'} gap={'3'}>
              {/* --- SHOPIFY STATUS BUTTON --- */}
              {location?.retailSoftware === 'shopify' && (
              <>
                <Button 
                  size="2" 
                  variant={isShopifyConnected ? "soft" : "outline"} 
                  color={isShopifyConnected ? "green" : "gray"}
                  style={{ cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => router.push('/admin/brand/onboard-shopify')}
                >
                    {isShopifyConnected ? (
                      <>
                        <CheckCircledIcon width="16" height="16" />
                        Shopify Active
                      </>
                    ) : (
                      <>
                        <Link2Icon width="16" height="16" />
                        Connect Shopify
                      </>
                    )}
                  </Button>

                <Separator orientation="vertical" style={{ height: '20px' }} />
              </>
              )}
              {location && (
              <Badge size="2" color="gray" variant="surface">{location.name}</Badge>
              )}

            </Flex>
            
          </Flex>

          {/* 1. METRICS GRID */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <StatCard 
              title="Total Players Engaged" 
              value={stats?.uniquePlayerCount ?? 0} 
              loading={isLoadingStats} 
              icon={<PersonIcon width="20" height="20" />}
            />
            <StatCard 
              title="Rewards Issued" 
              value={totalRewardsCount} 
              loading={isLoadingRewards} 
              icon={<TicketIcon width="20" height="20" />}
            />
            {/* Placeholder for future metric 
            <StatCard 
              title="Redemption Rate" 
              value="-" 
              loading={false} 
              icon={<CheckCircledIcon width="20" height="20" />} 
            />
            */}
          </Grid>

          <Grid columns={{ initial: '1', lg: '3' }} gap="6">
            
            {/* 2. RECENT REWARDS TABLE (Takes up 2/3 width on large screens) */}
            <Box style={{ gridColumn: 'span 2' }}>
              <Heading size="4" mb="3">Reward Log</Heading>
              <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
                {rewardsError && <Callout.Root color="red" m="4"><Callout.Text>{rewardsError}</Callout.Text></Callout.Root>}
                
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
                      <Table.Row><Table.Cell colSpan={4}><Flex justify="center" p="4"><Spinner/></Flex></Table.Cell></Table.Row>
                    ) : rewards.length > 0 ? (
                      rewards.map((entry) => (
                        <Table.Row key={entry._id}>
                          <Table.RowHeaderCell>
                            <Flex gap="3" align="center">
                              <Avatar size="1" fallback={entry.playerName.charAt(0)} radius="full" />
                              <Flex direction="column">
                                <Text size="2" weight="medium">{entry.playerName}</Text>
                              </Flex>
                            </Flex>
                          </Table.RowHeaderCell>
                          <Table.Cell>
                            <Flex direction="column">
                              <Text size="2">{entry.rewardName}</Text>
                              <Flex gap="2" align="center">
                                <CodeBadge code={entry.code} />
                                {entry.rewardProduct && <Text size="1" color="gray">({entry.rewardProduct})</Text>}
                              </Flex>
                            </Flex>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2">{entry.achievementName || "—"}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            {entry.redeemed ? (
                              <Badge color="green" radius="full">Redeemed</Badge>
                            ) : (
                              <Badge color="amber" radius="full">Active</Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" color="gray">{formatDate(entry.earnedAt)}</Text>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    ) : (
                      <Table.Row><Table.Cell colSpan={4}><Text color="gray" align="center">No rewards yet.</Text></Table.Cell></Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>

                {/* Pagination */}
                <Flex justify="between" align="center" p="3" style={{ borderTop: '1px solid var(--gray-a4)', backgroundColor: 'var(--gray-2)' }}>
                  <Text size="1" color="gray">Page {page} of {totalPages}</Text>
                  <Flex gap="2">
                    <Button variant="soft" color="gray" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <ChevronLeftIcon /> Prev
                    </Button>
                    <Button variant="soft" color="gray" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Next <ChevronRightIcon />
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            </Box>

            {/* 3. TOP PLAYERS LIST (Takes up 1/3 width) */}
            <Flex direction="column">
              <Heading size="4" mb="3">Top Players</Heading>
              <Card size="2">
                {isLoadingStats ? (
                  <Flex justify="center" p="4"><Spinner /></Flex>
                ) : (
                  <Flex direction="column" gap="1">
                    {stats && stats.topPlayers.length > 0 ? stats.topPlayers.map((player, idx) => (
                      <Flex key={idx} justify="between" align="center" p="2" style={{ borderBottom: idx < stats.topPlayers.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                        <Flex gap="3" align="center">
                          <Text size="2" color="gray" style={{ width: '20px' }}>#{idx + 1}</Text>
                          <Avatar size="1" fallback={player.name.charAt(0)} radius="full" />
                          <Text size="2" weight="medium">{player.name}</Text>
                        </Flex>
                        <Flex gap="2" align="center">
                          {idx === 0 && <TrophyIcon color="gold" />}
                          <Text size="2" weight="bold">{player.winCount}</Text>
                          <Text size="1" color="gray">wins</Text>
                        </Flex>
                      </Flex>
                    )) : (
                      <Text color="gray" size="2" align="center" my="4">No player data available.</Text>
                    )}
                  </Flex>
                )}
              </Card>
            </Flex>

          </Grid>

        </Flex>
      </Flex>
    </Flex>
  )
}