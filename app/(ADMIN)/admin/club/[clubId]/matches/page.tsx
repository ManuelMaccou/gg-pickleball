'use client';

import { useEffect, useState, useCallback, use } from 'react';
import {
  Badge, Button, Callout, Flex, Spinner, Table, Text,
  Box, Heading, Separator, Tabs, IconButton, Grid,
} from '@radix-ui/themes';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, ReloadIcon } from '@radix-ui/react-icons';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { UploadMatchesDrawer } from '../../components/UploadMatchesDrawer';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface PlayerLite { name: string; email?: string; duprId: string; }
interface TeamLite {
  player1: PlayerLite; player2: PlayerLite;
  game1: number; game2: number; game3: number; game4: number; game5: number;
}
interface UploadedMatchRow {
  _id: string; matchDate: string; teamA: TeamLite; teamB: TeamLite;
  location?: string; duprSubmissionStatus: 'draft' | 'pending' | 'submitted' | 'failed';
  duprMatchId?: string; duprSubmissionError?: string; createdAt: string;
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

const thStyle = {
  color: 'rgba(255,255,255,0.7)', fontSize: 11,
  textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 500,
};

export default function ClubMatchesPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params);
  const router = useRouter();

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

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/club/matches/${deleteTargetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Delete failed');
      }
      setDeleteTargetId(null);
      loadRows();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // Auth error state
  if (authError) {
    return (
      <Flex direction="column" align="center" justify="center" gap="5"
        style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Flex align="center" justify="center" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)',
        }}>
          <AlertCircle size={22} color="#f87171" />
        </Flex>
        <Flex direction="column" align="center" gap="2" style={{ textAlign: 'center', maxWidth: 360 }}>
          <Text size="4" weight="bold" style={{ color: '#fff' }}>Access denied</Text>
          <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>{authError}</Text>
        </Flex>
        <Button variant="soft" color="gray" onClick={() => router.push('/admin/club')} style={{ cursor: 'pointer' }}>
          ← Back to clubs
        </Button>
      </Flex>
    );
  }

  if (!club) {
    return (
      <Flex justify="center" align="center" height="100vh" style={{ backgroundColor: '#0a0a0a' }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  const submittedCount = rows.filter((r) => r.duprSubmissionStatus === 'submitted').length;

  return (
    <Flex direction="column" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>

      {/* Header */}
      <Flex justify="between" align="center" px="6" style={{
        height: 64, backgroundColor: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Flex align="center" gap="4">
          <Text weight="bold" size="3" style={{ color: '#fff' }}>Club Matches</Text>
          <Separator orientation="vertical" style={{ height: 20, backgroundColor: 'rgba(255,255,255,0.12)' }} />
          <Badge size="2" variant="surface" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
            {club.name}
          </Badge>
        </Flex>
        <Button
          onClick={() => setDrawerOpen(true)}
          radius="full"
          style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}
        >
          <PlusIcon /> Upload matches
        </Button>
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="6" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Heading size="6" style={{ color: '#fff' }}>Matches</Heading>

          {/* Delete error */}
          {deleteError && (
            <Callout.Root color="red">
              <Callout.Text>{deleteError}</Callout.Text>
            </Callout.Root>
          )}

          {/* Stat cards */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <Box style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px' }}>
              <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Uploaded to DUPR</Text>
              <Text size="6" weight="bold" style={{ color: '#fff' }}>{total}</Text>
            </Box>
            <Box style={{ background: 'rgba(163,230,53,0.1)', border: '0.5px solid rgba(163,230,53,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <Text size="1" style={{ color: 'rgba(163,230,53,0.6)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Successfully submitted</Text>
              <Text size="6" weight="bold" style={{ color: '#a3e635' }}>{submittedCount}</Text>
            </Box>
          </Grid>

          {/* Tabs */}
          <Tabs.Root value={tab} onValueChange={(v) => { setTab(v as 'uploaded' | 'synced'); setPage(1); }}>
            <Tabs.List>
              <Tabs.Trigger value="uploaded" style={{ color: tab === 'uploaded' ? '#fff' : 'rgba(255,255,255,0.8)' }}>Uploaded by you</Tabs.Trigger>
              <Tabs.Trigger value="synced" style={{ color: tab === 'synced' ? '#fff' : 'rgba(255,255,255,0.8)' }}>Synced from community</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {/* Table */}
          <Box style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            {error && (
              <Callout.Root color="red" m="4">
                <Flex justify="between" align="center" gap="4" style={{ flex: 1 }}>
                  <Callout.Text>{error}</Callout.Text>
                  <Button size="1" variant="soft" color="red" onClick={loadRows} style={{ flexShrink: 0, cursor: 'pointer' }}>
                    <ReloadIcon /> Try again
                  </Button>
                </Flex>
              </Callout.Root>
            )}
            <Table.Root>
              <Table.Header>
                <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <Table.ColumnHeaderCell style={thStyle}>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={thStyle}>Team A</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={thStyle}>Team B</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={thStyle}>Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={thStyle}>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row><Table.Cell colSpan={6}><Flex justify="center" p="5"><Spinner /></Flex></Table.Cell></Table.Row>
                ) : rows.length === 0 ? (
                  <Table.Row><Table.Cell colSpan={6}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }} align="center" my="4" size="2">
                      {tab === 'uploaded' ? 'No matches uploaded yet.' : 'No synced matches yet.'}
                    </Text>
                  </Table.Cell></Table.Row>
                ) : rows.map((m) => (
                  <Table.Row key={m._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDate(m.matchDate)}</Text></Table.Cell>
                    <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamA.player1.name} & {m.teamA.player2.name}</Text></Table.Cell>
                    <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamB.player1.name} & {m.teamB.player2.name}</Text></Table.Cell>
                    <Table.Cell><Text size="2" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>{formatScore(m.teamA, m.teamB)}</Text></Table.Cell>
                    <Table.Cell><StatusBadge status={m.duprSubmissionStatus} /></Table.Cell>
                    <Table.Cell>
                      {tab === 'uploaded' && m.duprSubmissionStatus === 'submitted' && (
                        <IconButton
                          size="1" variant="ghost" color="red"
                          onClick={() => { setDeleteError(null); setDeleteTargetId(m._id); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <TrashIcon />
                        </IconButton>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>

            <Flex justify="between" align="center" px="4" py="3"
              style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <Text size="1" style={{ color: 'rgba(255,255,255,0.7)' }}>Page {page} of {totalPages}</Text>
              <Flex gap="2">
                <Button variant="soft" color="gray" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /> Prev</Button>
                <Button variant="soft" color="gray" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next <ChevronRightIcon /></Button>
              </Flex>
            </Flex>
          </Box>
        </Flex>
      </Box>

      <UploadMatchesDrawer clubId={club._id} open={drawerOpen} onOpenChange={setDrawerOpen} onSubmitted={loadRows} />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title="Delete match"
        description="This will permanently delete the match from DUPR and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        confirming={deleting}
        destructive
      />
    </Flex>
  );
}