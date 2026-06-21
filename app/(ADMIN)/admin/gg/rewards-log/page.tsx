'use client';

// app/(ADMIN)/admin/gg/rewards-log/page.tsx
//
// Superadmin view of reward processing log events.
// Shows auth failures, achievement events, generator errors, and reward code
// events emitted during player match syncs.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Box, Button, Card, Callout, Flex, Heading,
  Select, Spinner, Table, Text, TextField,
} from '@radix-ui/themes';
import {
  ChevronLeftIcon, ChevronRightIcon, InfoCircledIcon,
} from '@radix-ui/react-icons';
import { DateTime } from 'luxon';
import { useUserContext } from '@/app/contexts/UserContext';
import { AdminSidebar } from '../../components/AdminSidebar';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'achievement' | 'reward_code' | 'auth_error' | 'generator' | 'general';

interface LogRecord {
  _id: string;
  userId: string;
  playerName: string;
  matchId: string;
  clientId?: string;
  clientName?: string;
  rewardId?: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface Summary {
  countInfo: number;
  countWarn: number;
  countError: number;
  countAuthErrors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<LogLevel, 'blue' | 'amber' | 'red'> = {
  info: 'blue',
  warn: 'amber',
  error: 'red',
};

const CATEGORY_LABEL: Record<LogCategory, string> = {
  achievement: 'Achievement',
  reward_code: 'Reward code',
  auth_error: 'Auth error',
  generator: 'Generator',
  general: 'General',
};

const formatDate = (s: string) =>
  DateTime.fromISO(s).toFormat('MMM d, yyyy HH:mm:ss');

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RewardsLogPage() {
  const { user } = useUserContext();
  const { isLoading: auth0IsLoading } = useAuth0User();
  const router = useRouter();

  const [records, setRecords] = useState<LogRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [levelFilter, setLevelFilter]       = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [playerFilter, setPlayerFilter]     = useState('');
  const [page, setPage]   = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Expanded row for metadata
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [adminPermission, setAdminPermission] = useState<'admin' | 'associate' | null>(null);

  useEffect(() => {
    if (user) setAdminPermission(user.superAdmin ? 'admin' : 'associate');
  }, [user]);

  useEffect(() => {
    if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/gg/rewards-log');
  }, [auth0IsLoading, user, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(levelFilter !== 'all' && { level: levelFilter }),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(playerFilter.trim() && { userId: playerFilter.trim() }),
      });
      const res = await fetch(`/api/admin/rewards-log?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load logs');
      setRecords(data.records);
      setSummary(data.summary);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading logs');
    } finally {
      setLoading(false);
    }
  }, [levelFilter, categoryFilter, playerFilter, page]);

  useEffect(() => {
    if (user?.superAdmin) fetchLogs();
  }, [user, fetchLogs]);

  if (user && !user.superAdmin) {
    return (
      <Flex align="center" justify="center" height="100vh">
        <Text>You do not have access to this page.</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      {/* Header */}
      <Flex
        justify="between" align="center"
        px={{ initial: '3', md: '9' }} py="4"
        style={{ borderBottom: '1px solid var(--gray-4)', backgroundColor: 'white' }}
      >
        <Flex direction="column" position="relative" maxWidth="80px">
          <Image src={darkGgLogo} alt="GG Pickleball" priority height={540} width={960} />
        </Flex>
        {!auth0IsLoading && (
          <Text size="3" weight="bold">
            {user?.name ? `Welcome ${String(user.name).split('@')[0]}` : ''}
          </Text>
        )}
      </Flex>

      <Flex direction="row" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <AdminSidebar adminPermission={adminPermission} />

        <Flex direction="column" py="4" px={{ initial: '2', md: '6' }} width="100%" style={{ overflowY: 'auto' }}>
          <Flex justify="between" align="center" mb="6">
            <Heading>Rewards Log</Heading>
            <Button variant="soft" color="gray" size="2" onClick={fetchLogs}>
              Refresh
            </Button>
          </Flex>

          {error && (
            <Callout.Root color="red" mb="4">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          {/* Summary cards */}
          {summary && (
            <Flex gap="3" mb="5" wrap="wrap">
              {[
                { label: 'Info',        count: summary.countInfo,       color: 'blue'  },
                { label: 'Warnings',    count: summary.countWarn,       color: 'amber' },
                { label: 'Errors',      count: summary.countError,      color: 'red'   },
                { label: 'Auth errors', count: summary.countAuthErrors, color: 'red'   },
              ].map(({ label, count, color }) => (
                <Card key={label} size="2" style={{ minWidth: 120 }}>
                  <Flex direction="column" gap="1">
                    <Badge color={color as any} variant="soft" size="1">{label}</Badge>
                    <Text size="5" weight="bold">{count}</Text>
                  </Flex>
                </Card>
              ))}
              <Card size="2" style={{ minWidth: 120 }}>
                <Flex direction="column" gap="1">
                  <Badge color="gray" variant="soft" size="1">Total</Badge>
                  <Text size="5" weight="bold">{total}</Text>
                </Flex>
              </Card>
            </Flex>
          )}

          {/* Filters */}
          <Flex gap="3" mb="4" wrap="wrap" align="center">
            <Select.Root value={levelFilter} onValueChange={v => { setLevelFilter(v); setPage(1); }}>
              <Select.Trigger placeholder="Level" />
              <Select.Content>
                <Select.Item value="all">All levels</Select.Item>
                <Select.Item value="info">Info</Select.Item>
                <Select.Item value="warn">Warning</Select.Item>
                <Select.Item value="error">Error</Select.Item>
              </Select.Content>
            </Select.Root>

            <Select.Root value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
              <Select.Trigger placeholder="Category" />
              <Select.Content>
                <Select.Item value="all">All categories</Select.Item>
                <Select.Item value="auth_error">Auth error</Select.Item>
                <Select.Item value="reward_code">Reward code</Select.Item>
                <Select.Item value="achievement">Achievement</Select.Item>
                <Select.Item value="generator">Generator</Select.Item>
                <Select.Item value="general">General</Select.Item>
              </Select.Content>
            </Select.Root>

            <TextField.Root
              placeholder="Filter by player ID"
              value={playerFilter}
              onChange={e => { setPlayerFilter(e.target.value); setPage(1); }}
              style={{ width: 220 }}
            />

            {(levelFilter !== 'all' || categoryFilter !== 'all' || playerFilter) && (
              <Button variant="ghost" color="gray" size="2" onClick={() => {
                setLevelFilter('all');
                setCategoryFilter('all');
                setPlayerFilter('');
                setPage(1);
              }}>
                Clear filters
              </Button>
            )}
          </Flex>

          {/* Table */}
          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Level</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Client</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Flex justify="center" p="6"><Spinner size="2" /></Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : records.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Text color="gray" align="center" my="4">No log entries found.</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : records.map(r => (
                  <>
                    <Table.Row
                      key={r._id}
                      style={{ cursor: r.metadata ? 'pointer' : 'default' }}
                      onClick={() => r.metadata && setExpandedId(expandedId === r._id ? null : r._id)}
                    >
                      <Table.Cell>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {formatDate(r.createdAt)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={LEVEL_COLOR[r.level]} size="1" radius="full">
                          {r.level}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{CATEGORY_LABEL[r.category]}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{r.playerName}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{r.clientName ?? '—'}</Text>
                      </Table.Cell>
                      <Table.Cell style={{ maxWidth: 400 }}>
                        <Text size="2" style={{ wordBreak: 'break-word' }}>{r.message}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {r.metadata && (
                          <Text size="1" color="blue" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {expandedId === r._id ? 'Hide' : 'Details'}
                          </Text>
                        )}
                      </Table.Cell>
                    </Table.Row>

                    {/* Expanded metadata row */}
                    {expandedId === r._id && r.metadata && (
                      <Table.Row key={`${r._id}-meta`}>
                        <Table.Cell colSpan={7}>
                          <Box
                            p="3"
                            style={{
                              backgroundColor: 'var(--gray-2)',
                              borderRadius: 6,
                              fontFamily: 'monospace',
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            {JSON.stringify(r.metadata, null, 2)}
                          </Box>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </>
                ))}
              </Table.Body>
            </Table.Root>

            {/* Pagination */}
            <Flex
              justify="between" align="center" p="3"
              style={{ borderTop: '1px solid var(--gray-a4)', backgroundColor: 'var(--gray-2)' }}
            >
              <Text size="1" color="gray">Page {page} of {totalPages} · {total} entries</Text>
              <Flex gap="2">
                <Button variant="soft" color="gray" size="1"
                  disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeftIcon /> Prev
                </Button>
                <Button variant="soft" color="gray" size="1"
                  disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      </Flex>
    </Flex>
  );
}