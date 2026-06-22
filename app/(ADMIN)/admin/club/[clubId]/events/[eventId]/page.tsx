'use client';

import { useEffect, useState, useCallback, use } from 'react';
import {
  Badge, Button, Callout, Flex, Spinner, Table, Text,
  Box, Heading, Separator, IconButton, Dialog,
} from '@radix-ui/themes';
import { ReloadIcon } from '@radix-ui/react-icons';
import { PlusIcon, TrashIcon, CheckCircledIcon, CrossCircledIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { ArrowRight, Upload, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { UploadMatchesDrawer } from '../../../components/UploadMatchesDrawer';
import { EditMatchDrawer } from '../../../components/EditMatchDrawer';
import { Breadcrumbs } from '@/app/(ADMIN)/admin/components/Breadcrumbs';
import { ConfirmDialog } from '../../../components/ConfirmDialog';


interface PlayerWithSync { name: string; email?: string; duprId: string; synced: boolean; }
interface TeamWithSync {
  player1: PlayerWithSync; player2: PlayerWithSync;
  game1: number; game2: number; game3: number; game4: number; game5: number;
}
interface SyncedMatchRow { _id: string; matchDate: string; duprMatchId: string; teamA: TeamWithSync; teamB: TeamWithSync; }
interface SyncSummary { totalMatches: number; syncedMatches: number; totalPlayers: number; syncedPlayers: number; }
interface UploadedMatchRow { _id: string; matchDate: string; teamA: any; teamB: any; duprSubmissionStatus: string; duprMatchId?: string; }
interface RegistrantRow { _id: string; name: string; email?: string; duprId: string; duprPlusVerifiedAtRegistration: boolean; registeredAt: string; }
interface EventDetail {
  _id: string; name: string; eventDate: string; eventType: 'past' | 'upcoming';
  accessLevel: 'open' | 'dupr_plus'; location?: string; description?: string;
  registrationCount: number; notes?: string; published: boolean;
}

const formatDate = (s: string) =>
  s ? DateTime.fromISO(s).setZone('America/Los_Angeles').toFormat('MMM d, yyyy') : '—';

const formatDateTime = (s: string) =>
  s ? DateTime.fromISO(s).setZone('America/Los_Angeles').toFormat('MMM d, yyyy · h:mm a') + ' PT' : '—';

// Header shows date + time for upcoming events
const formatEventDateTimeHeader = (s: string) =>
  s ? DateTime.fromISO(s).setZone('America/Los_Angeles').toFormat('MMM d, yyyy · h:mm a') + ' PT' : '—';

const SyncIcon = ({ synced }: { synced: boolean }) =>
  synced
    ? <CheckCircledIcon color="var(--green-9)" width="16" height="16" />
    : <CrossCircledIcon color="var(--gray-8)" width="16" height="16" />;

const formatScore = (a: any, b: any): string => {
  const games: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const aScore = a[`game${i}`] as number;
    const bScore = b[`game${i}`] as number;
    if (aScore === 0 && bScore === 0) continue;
    games.push(`${aScore}-${bScore}`);
  }
  return games.join(', ') || '—';
};

const StatCard = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
  <Box style={{
    background: accent ? 'rgba(163,230,53,0.1)' : 'rgba(255,255,255,0.04)',
    border: `0.5px solid ${accent ? 'rgba(163,230,53,0.2)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10, padding: '12px 16px',
  }}>
    <Text size="1" style={{ color: accent ? 'rgba(163,230,53,0.6)' : 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>{label}</Text>
    <Text size="6" weight="bold" style={{ color: accent ? '#a3e635' : '#fff', lineHeight: 1 }}>{value}</Text>
  </Box>
);

const DarkTableWrap = ({ children }: { children: React.ReactNode }) => (
  <Box style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
    {children}
  </Box>
);

const thStyle = { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 500 };

export default function EventDetailPage({ params }: { params: Promise<{ clubId: string; eventId: string }> }) {
  const { clubId, eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [uploadedMatches, setUploadedMatches] = useState<UploadedMatchRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrantRow[]>([]);
  const [syncData, setSyncData] = useState<{ matches: SyncedMatchRow[]; summary: SyncSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Publish/unpublish state ───────────────────────────────────────────────
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/club/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) {
        // 403 is an auth error — surface differently
        if (res.status === 403 || res.status === 401) {
          setAuthError(data.error ?? 'Access denied');
          return;
        }
        throw new Error(data.error);
      }
      setEvent(data.event);
      setUploadedMatches(data.matches ?? []);
      setRegistrations(data.registrations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadSyncStatus = useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/club/events/${eventId}/sync-status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncData(data);
    } catch (e) {
      console.error('[EventDetail] Sync status error:', e);
    } finally {
      setSyncLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  useEffect(() => {
    if (uploadedMatches.some((m) => m.duprSubmissionStatus === 'submitted')) {
      loadSyncStatus();
    }
  }, [uploadedMatches, loadSyncStatus]);

  const handleTogglePublished = async () => {
    if (!event) return;
    setPublishing(true);
    setPublishError(null);
    const newValue = !event.published;
    try {
      const res = await fetch(`/api/club/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to update event');
      }
      setEvent((prev) => prev ? { ...prev, published: newValue } : prev);
      setPublishConfirmOpen(false);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPublishing(false);
    }
  };

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
      loadEvent();
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
        <Button variant="soft" color="gray" onClick={() => router.push(`/admin/club/${clubId}/events`)} style={{ cursor: 'pointer' }}>
          ← Back to events
        </Button>
      </Flex>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Flex justify="center" align="center" height="100vh" style={{ backgroundColor: '#0a0a0a' }}>
        <Spinner size="3" style={{color: '#a3e635'}}/>
      </Flex>
    );
  }

  // Fetch error state with retry
  if (error) {
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
          <Text size="4" weight="bold" style={{ color: '#fff' }}>Couldn't load event</Text>
          <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</Text>
        </Flex>
        <Flex gap="3">
          <Button onClick={loadEvent} style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 'bold', cursor: 'pointer' }} radius="full">
            Try again
          </Button>
          <Button variant="soft" color="gray" onClick={() => router.push(`/admin/club/${clubId}/events`)} style={{ cursor: 'pointer' }}>
            ← Back to events
          </Button>
        </Flex>
      </Flex>
    );
  }

  if (!event) return null;

  const isUpcoming = event.eventType === 'upcoming';
  const submittedCount = uploadedMatches.filter((m) => m.duprSubmissionStatus === 'submitted').length;
  const failedCount = uploadedMatches.filter((m) => m.duprSubmissionStatus === 'failed').length;

  return (
    <Flex direction="column" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <Flex direction={'column'} align={'center'} justify={'center'} height={'50px'}
        style={{backgroundColor: "#5b1010"}}>
          <Text style={{color: 'white'}}>This feature is in beta. Please contact us with any feature requests.</Text>
      </Flex>
      <Flex justify="between" align="center" px="6" style={{
        height: 64, backgroundColor: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 50, gap: 12,
      }}>
        <Flex align="center" gap="3" style={{ minWidth: 0 }}>
          <Text weight="bold" size="3" style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.name}</Text>
          <Separator orientation="vertical" style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
          <Text size="2" style={{ color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>{formatEventDateTimeHeader(event.eventDate)}</Text>
          {isUpcoming && <Badge size="1" color="blue" variant="soft">Upcoming</Badge>}
          {event.accessLevel === 'dupr_plus' && <Badge size="1" color="amber" variant="soft">DUPR+</Badge>}
        </Flex>
        <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
          {isUpcoming && (
            <Button
              color={event.published ? 'red' : 'green'}
              radius="full"
              onClick={() => { setPublishError(null); setPublishConfirmOpen(true); }}
              style={{ cursor: 'pointer' }}
            >
              {event.published ? 'Unpublish' : 'Publish'}
            </Button>
          )}
          {!isUpcoming && (
            <Button onClick={() => setDrawerOpen(true)} radius="full"
              style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}>
              <PlusIcon /> Add Matches
            </Button>
          )}
        </Flex>
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="6" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Breadcrumbs crumbs={[
            { label: 'My Clubs', href: '/admin/club' },
            { label: 'Events', href: `/admin/club/${clubId}/events` },
            { label: event.name },
          ]} />

          {/* Delete error banner */}
          {deleteError && (
            <Callout.Root color="red">
              <Callout.Text>{deleteError}</Callout.Text>
            </Callout.Root>
          )}

          {/* Publish error */}
          {publishError && (
            <Callout.Root color="red">
              <Callout.Text>{publishError}</Callout.Text>
            </Callout.Root>
          )}

          {/* Unpublished banner */}
          {isUpcoming && !event.published && (
            <Box style={{
              background: 'rgba(245,158,11,0.08)',
              border: '0.5px solid rgba(245,158,11,0.2)',
              borderRadius: 12,
              padding: '14px 18px',
            }}>
              <Flex align="center" gap="3">
                <Box>
                  <Text size="2" weight="bold" style={{ color: '#fbbf24', display: 'block' }}>
                    This event is unpublished
                  </Text>
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Players can no longer see or register for this event. Existing registrations are preserved.
                    Click "Publish" to make it visible again.
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          {isUpcoming && (
            <>
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <StatCard label="Registered" value={event.registrationCount} accent />
                {event.location && <StatCard label="Location" value={event.location} />}
                <StatCard label="Access" value={event.accessLevel === 'dupr_plus' ? 'DUPR+ only' : 'Open to all'} />
              </Box>

              {/* Live / unpublished banner — shown inline in the upcoming content area */}
              {event.published ? (
                <Box style={{
                  background: 'rgba(163,230,53,0.06)',
                  border: '0.5px solid rgba(163,230,53,0.2)',
                  borderRadius: 12,
                  padding: '14px 18px',
                }}>
                  <Flex align="center" gap="3">
                    <Flex align="center" justify="center" style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(163,230,53,0.15)',
                      border: '0.5px solid rgba(163,230,53,0.3)',
                    }}>
                      <CheckCircledIcon color="#a3e635" width={16} height={16} />
                    </Flex>
                    <Box>
                      <Text size="2" weight="bold" style={{ color: '#a3e635', display: 'block' }}>
                        Your event is live
                      </Text>
                      <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        Players can see and register for this event. Check back here to monitor registrations.
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              ) : null}

              {event.description && (
                <Box style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px' }}>
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Description</Text>
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>{event.description}</Text>
                </Box>
              )}

              <Flex align="center" gap="2">
                <Heading size="5" style={{ color: '#fff' }}>Registrants</Heading>
                {registrations.length > 0 && <Text size="3" style={{ color: 'rgba(255,255,255,0.8)' }}>({registrations.length})</Text>}
              </Flex>

              <DarkTableWrap>
                <Table.Root>
                  <Table.Header>
                    <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <Table.ColumnHeaderCell style={thStyle}>Name</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>Email</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>DUPR ID</Table.ColumnHeaderCell>
                      {event.accessLevel === 'dupr_plus' && <Table.ColumnHeaderCell style={thStyle}>DUPR+ Verified</Table.ColumnHeaderCell>}
                      <Table.ColumnHeaderCell style={thStyle}>Registered</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {registrations.length === 0 ? (
                      <Table.Row><Table.Cell colSpan={event.accessLevel === 'dupr_plus' ? 5 : 4}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)' }} align="center" my="4" size="2">No registrations yet.</Text>
                      </Table.Cell></Table.Row>
                    ) : registrations.map((r) => (
                      <Table.Row key={r._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                        <Table.Cell><Text size="2" weight="medium" style={{ color: '#fff' }}>{r.name}</Text></Table.Cell>
                        <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>{r.email ?? '—'}</Text></Table.Cell>
                        <Table.Cell><Text size="2" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>{r.duprId}</Text></Table.Cell>
                        {event.accessLevel === 'dupr_plus' && (
                          <Table.Cell>
                            <Flex align="center" gap="1">
                              <SyncIcon synced={r.duprPlusVerifiedAtRegistration} />
                              <Text size="2" style={{ color: r.duprPlusVerifiedAtRegistration ? '#84cc16' : 'rgba(255,255,255,0.8)' }}>
                                {r.duprPlusVerifiedAtRegistration ? 'Verified' : 'Not verified'}
                              </Text>
                            </Flex>
                          </Table.Cell>
                        )}
                        <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>{formatDateTime(r.registeredAt)}</Text></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </DarkTableWrap>
            </>
          )}

          {!isUpcoming && (
            <>
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <StatCard label="Total Matches" value={uploadedMatches.length} />
                <StatCard label="Submitted to DUPR" value={submittedCount} accent={submittedCount > 0} />
                {syncData && (
                  <>
                    <StatCard label="Players Synced" value={`${syncData.summary.syncedPlayers} / ${syncData.summary.totalPlayers}`} accent={syncData.summary.syncedPlayers > 0} />
                    <StatCard label="Matches Synced" value={`${syncData.summary.syncedMatches} / ${syncData.summary.totalMatches}`} />
                  </>
                )}
                {failedCount > 0 && (
                  <Box style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                    <Text size="1" style={{ color: 'rgba(239,68,68,0.6)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Failed</Text>
                    <Text size="6" weight="bold" style={{ color: '#f87171', lineHeight: 1 }}>{failedCount}</Text>
                  </Box>
                )}
              </Box>

              <Heading size="5" style={{ color: '#fff' }}>Matches</Heading>

              <DarkTableWrap>
                <Table.Root>
                  <Table.Header>
                    <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <Table.ColumnHeaderCell style={thStyle}>Date</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>Team A</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>Team B</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>Score</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>DUPR Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell />
                      <Table.ColumnHeaderCell />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {uploadedMatches.length === 0 ? (
                      <Table.Row><Table.Cell colSpan={6}>
                        <Flex direction="column" align="center" py="7" gap="2">
                          <Upload size={24} color="rgba(255,255,255,0.5)" />
                          <Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>No matches yet. Click "Add Matches" to get started.</Text>
                        </Flex>
                      </Table.Cell></Table.Row>
                    ) : uploadedMatches.map((m) => (
                      <Table.Row key={m._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                        <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{formatDate(m.matchDate)}</Text></Table.Cell>
                        <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamA.player1.name} & {m.teamA.player2.name}</Text></Table.Cell>
                        <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamB.player1.name} & {m.teamB.player2.name}</Text></Table.Cell>
                        <Table.Cell><Text size="2" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>{formatScore(m.teamA, m.teamB)}</Text></Table.Cell>
                        <Table.Cell>
                          <Badge radius="full" color={
                            m.duprSubmissionStatus === 'submitted' ? 'green' :
                            m.duprSubmissionStatus === 'failed' ? 'red' :
                            m.duprSubmissionStatus === 'pending' ? 'blue' : 'gray'
                          }>
                            {m.duprSubmissionStatus}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <IconButton size="1" variant="ghost" color="gray"
                            onClick={() => { setEditingMatch(m); setEditOpen(true); }}
                            disabled={m.duprSubmissionStatus !== 'submitted'}>
                            <Pencil1Icon />
                          </IconButton>
                        </Table.Cell>
                        <Table.Cell>
                          <IconButton size="1" variant="ghost" color="red"
                            onClick={() => { setDeleteError(null); setDeleteTargetId(m._id); }}
                            style={{ cursor: 'pointer' }}>
                            <TrashIcon />
                          </IconButton>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </DarkTableWrap>

              {syncData && syncData.matches.length > 0 && (
                <>
                  <Flex align="center" gap="3">
                    <Heading size="5" style={{ color: '#fff' }}>Player Sync Status</Heading>
                    {syncLoading && <Spinner size="1" style={{color: '#a3e635'}}/>}
                  </Flex>
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.7)', marginTop: -12 }}>
                    Shows which players have synced their DUPR account to pick up these matches.
                  </Text>
                  <DarkTableWrap>
                    <Table.Root>
                      <Table.Header>
                        <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                          <Table.ColumnHeaderCell style={thStyle}>Match</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell style={thStyle}>Team A · P1</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell style={thStyle}>Team A · P2</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell style={thStyle}>Team B · P1</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell style={thStyle}>Team B · P2</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {syncData.matches.map((m) => (
                          <Table.Row key={m._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                            <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{formatDate(m.matchDate)}</Text></Table.Cell>
                            {[m.teamA.player1, m.teamA.player2, m.teamB.player1, m.teamB.player2].map((p, i) => (
                              <Table.Cell key={i}>
                                <Flex align="center" gap="2">
                                  <SyncIcon synced={p.synced} />
                                  <Text size="2" style={{ color: p.synced ? '#fff' : 'rgba(255,255,255,0.7)' }}>{p.name}</Text>
                                </Flex>
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </DarkTableWrap>
                </>
              )}
            </>
          )}
        </Flex>
      </Box>

      {!isUpcoming && (
        <>
          <UploadMatchesDrawer clubId={clubId} eventId={eventId} open={drawerOpen} onOpenChange={setDrawerOpen} onSubmitted={loadEvent} />
          <EditMatchDrawer match={editingMatch} open={editOpen} onOpenChange={setEditOpen} onUpdated={loadEvent} />
        </>
      )}

      {/* Publish / unpublish confirmation */}
      <Dialog.Root open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <Dialog.Content style={{ maxWidth: 420, backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <Dialog.Title style={{ color: '#fff' }}>
            {event?.published ? 'Unpublish this event?' : 'Re-publish this event?'}
          </Dialog.Title>
          <Dialog.Description size="2" mb="5" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {event?.published
              ? 'The event will be hidden from the player feed immediately. Players who are already registered will see it marked as cancelled and can contact you. All registrations are preserved.'
              : 'The event will become visible to players again. Existing registrations will be restored to active status.'}
          </Dialog.Description>
          <Flex gap="3" justify="between">
            <Button variant="ghost" onClick={() => setPublishConfirmOpen(false)} style={{ cursor: 'pointer' }}>
              Cancel
            </Button>
            <Button
              color={event?.published ? 'amber' : 'green'}
              onClick={handleTogglePublished}
              disabled={publishing}
              style={{ cursor: publishing ? 'default' : 'pointer' }}
            >
              {publishing
                ? (event?.published ? 'Unpublishing…' : 'Re-publishing…')
                : (event?.published ? 'Unpublish' : 'Re-publish')}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete confirmation dialog — replaces confirm() */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        title="Delete match"
        description="This will permanently delete the match from DUPR. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        confirming={deleting}
        destructive
      />
    </Flex>
  );
}