'use client';

import { useEffect, useState, useCallback, use } from 'react';
import {
  Badge, Button, Callout, Card, Flex, Spinner, Table, Text,
  Grid, Box, Heading, Separator, Tabs, IconButton,
} from '@radix-ui/themes';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DateTime } from 'luxon';
import { UploadMatchesDrawer } from '../../components/UploadMatchesDrawer';

interface PlayerLite { name: string; email?: string; duprId: string; }
interface TeamLite {
  player1: PlayerLite; player2: PlayerLite;
  game1: number; game2: number; game3: number; game4: number; game5: number;
}
interface UploadedMatchRow {
  _id: string;
  matchDate: string;
  teamA: TeamLite;
  teamB: TeamLite;
  location?: string;
  duprSubmissionStatus: 'draft' | 'pending' | 'submitted' | 'failed';
  duprMatchId?: string;
  duprSubmissionError?: string;
  createdAt: string;
}

const formatDate = (s: string) => (s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—');

const StatusBadge = ({ status }: { status: UploadedMatchRow['duprSubmissionStatus'] }) => {
  const map = {
    draft: { color: 'gray' as const, label: 'Draft' },
    pending: { color: 'blue' as const, label: 'Pending' },
    submitted: { color: 'green' as const, label: 'Submitted' },
    failed: { color: 'red' as const, label: 'Failed' },
  };
  const { color, label } = map[status];
  return <Badge color={color} radius="full">{label}</Badge>;
};

// Render score line from the 5 game slots, skipping unplayed (both 0)
const formatScore = (a: TeamLite, b: TeamLite): string => {
  const games: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const aScore = a[`game${i}` as keyof TeamLite] as number;
    const bScore = b[`game${i}` as keyof TeamLite] as number;
    if (aScore === 0 && bScore === 0) continue;
    games.push(`${aScore}-${bScore}`);
  }
  return games.join(', ') || '—';
};

export default function ClubMatchesPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params);
  const [club, setClub] = useState<{ _id: string; name: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<'uploaded' | 'synced'>('uploaded');
  const [rows, setRows] = useState<UploadedMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch club info — also acts as the auth gate. If the logged-in user
  // doesn't admin this club, the API returns 403 and we show an error.
  useEffect(() => {
    fetch(`/api/club/${clubId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Access denied');
        setClub(data.club);
      })
      .catch((e) => setAuthError(e.message));
  }, [clubId]);

  const loadRows = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/club/matches?clubId=${club._id}&view=${tab}&page=${page}&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading matches');
    } finally {
      setLoading(false);
    }
  }, [club, tab, page]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this match from DUPR? This cannot be undone.')) return;
    const res = await fetch(`/api/club/matches/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Delete failed');
      return;
    }
    loadRows();
  };

  if (authError) return <Flex justify="center" p="9"><Text color="red">{authError}</Text></Flex>;
  if (!club) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;

  const submittedCount = rows.filter((r) => r.duprSubmissionStatus === 'submitted').length;

  return (
    <Flex direction="column" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <Flex justify="between" align="center" height="64px" px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}>
        <Flex align="center" gap="4">
          <Text weight="bold" size="3">Club Matches</Text>
          <Separator orientation="vertical" style={{ height: 20 }} />
          <Badge size="2" color="gray" variant="surface">{club.name}</Badge>
        </Flex>
        <Button onClick={() => setDrawerOpen(true)}>
          <PlusIcon /> Upload matches
        </Button>
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="6" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Heading size="6">Matches</Heading>

          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <Card size="2">
              <Text size="2" color="gray">Uploaded to DUPR</Text>
              <Text size="6" weight="bold">{total}</Text>
            </Card>
            <Card size="2">
              <Text size="2" color="gray">Successfully submitted</Text>
              <Text size="6" weight="bold">{submittedCount}</Text>
            </Card>
          </Grid>

          <Tabs.Root value={tab} onValueChange={(v) => { setTab(v as 'uploaded' | 'synced'); setPage(1); }}>
            <Tabs.List>
              <Tabs.Trigger value="uploaded">Uploaded by you</Tabs.Trigger>
              <Tabs.Trigger value="synced">Synced from community</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            {error && <Callout.Root color="red" m="4"><Callout.Text>{error}</Callout.Text></Callout.Root>}
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Team A</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Team B</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row><Table.Cell colSpan={6}><Flex justify="center" p="4"><Spinner /></Flex></Table.Cell></Table.Row>
                ) : rows.length === 0 ? (
                  <Table.Row><Table.Cell colSpan={6}>
                    <Text color="gray" align="center" my="4">
                      {tab === 'uploaded' ? 'No matches uploaded yet.' : 'No synced matches yet.'}
                    </Text>
                  </Table.Cell></Table.Row>
                ) : (
                  rows.map((m) => (
                    <Table.Row key={m._id}>
                      <Table.Cell><Text size="2">{formatDate(m.matchDate)}</Text></Table.Cell>
                      <Table.Cell><Text size="2">{m.teamA.player1.name} & {m.teamA.player2.name}</Text></Table.Cell>
                      <Table.Cell><Text size="2">{m.teamB.player1.name} & {m.teamB.player2.name}</Text></Table.Cell>
                      <Table.Cell><Text size="2" style={{ fontFamily: 'monospace' }}>{formatScore(m.teamA, m.teamB)}</Text></Table.Cell>
                      <Table.Cell><StatusBadge status={m.duprSubmissionStatus} /></Table.Cell>
                      <Table.Cell>
                        {tab === 'uploaded' && m.duprSubmissionStatus === 'submitted' && (
                          <IconButton size="1" variant="ghost" color="red" onClick={() => handleDelete(m._id)}>
                            <TrashIcon />
                          </IconButton>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
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
        </Flex>
      </Box>

      <UploadMatchesDrawer
        clubId={club._id}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmitted={loadRows}
      />
    </Flex>
  );
}