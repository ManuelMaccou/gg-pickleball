'use client';

import { useEffect, useState, useCallback, use } from 'react';
import {
  Badge, Button, Callout, Flex, Spinner, Table, Text,
  Box, Heading, Separator, IconButton,
} from '@radix-ui/themes';
import { PlusIcon, TrashIcon, CheckCircledIcon, CrossCircledIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { ArrowRight, Users, Upload, CheckCircle2, XCircle, MapPin, Lock, Unlock } from 'lucide-react';
import { DateTime } from 'luxon';
import { UploadMatchesDrawer } from '../../../components/UploadMatchesDrawer';
import { EditMatchDrawer } from '../../../components/EditMatchDrawer';
import { Breadcrumbs } from '@/app/(ADMIN)/admin/components/Breadcrumbs';

// ── Types (unchanged) ──────────────────────────────────────────────────────

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
  registrationCount: number; notes?: string;
}

const formatDate = (s: string) => (s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—');
const formatDateTime = (s: string) => s ? DateTime.fromISO(s).toFormat('MMM d, yyyy · h:mm a') : '—';

// ── SyncIcon (unchanged logic) ─────────────────────────────────────────────
const SyncIcon = ({ synced }: { synced: boolean }) =>
  synced
    ? <CheckCircledIcon color="var(--green-9)" width="16" height="16" />
    : <CrossCircledIcon color="var(--gray-8)" width="16" height="16" />;

// ── formatScore (unchanged) ────────────────────────────────────────────────
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

// ── Stat card ──────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, accent = false,
}: {
  label: string; value: string | number; accent?: boolean;
}) => (
  <Box style={{
    background: accent ? 'rgba(163,230,53,0.1)' : 'rgba(255,255,255,0.04)',
    border: `0.5px solid ${accent ? 'rgba(163,230,53,0.2)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10,
    padding: '12px 16px',
  }}>
    <Text size="1" style={{ color: accent ? 'rgba(163,230,53,0.6)' : 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
      {label}
    </Text>
    <Text size="6" weight="bold" style={{ color: accent ? '#a3e635' : '#fff', lineHeight: 1 }}>
      {value}
    </Text>
  </Box>
);

// ── Dark table wrapper ─────────────────────────────────────────────────────
const DarkTableWrap = ({ children }: { children: React.ReactNode }) => (
  <Box style={{
    background: '#111',
    border: '0.5px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
  }}>
    {children}
  </Box>
);

const thStyle = {
  color: 'rgba(255,255,255,0.4)',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 500,
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function EventDetailPage({ params }: { params: Promise<{ clubId: string; eventId: string }> }) {
  const { clubId, eventId } = use(params);

  // ── State (unchanged) ──
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [uploadedMatches, setUploadedMatches] = useState<UploadedMatchRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrantRow[]>([]);
  const [syncData, setSyncData] = useState<{ matches: SyncedMatchRow[]; summary: SyncSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  // ── loadEvent (unchanged) ──
  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/club/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data.event);
      setUploadedMatches(data.matches ?? []);
      setRegistrations(data.registrations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // ── loadSyncStatus (unchanged) ──
  const loadSyncStatus = useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/club/events/${eventId}/sync-status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncData(data);
    } catch (e) {
      console.error('Sync status error:', e);
    } finally {
      setSyncLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  // ── Sync status trigger (unchanged condition) ──
  useEffect(() => {
    if (uploadedMatches.some((m) => m.duprSubmissionStatus === 'submitted')) {
      loadSyncStatus();
    }
  }, [uploadedMatches, loadSyncStatus]);

  // ── handleDelete (unchanged — uses confirm()) ──
  const handleDelete = async (matchId: string) => {
    if (!confirm('Delete this match? This will also delete it from DUPR.')) return;
    const res = await fetch(`/api/club/matches/${matchId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Delete failed');
      return;
    }
    loadEvent();
  };

  if (loading) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  if (error) return <Flex justify="center" p="9"><Text color="red">{error}</Text></Flex>;
  if (!event) return null;

  const isUpcoming = event.eventType === 'upcoming';
  const submittedCount = uploadedMatches.filter((m) => m.duprSubmissionStatus === 'submitted').length;
  const failedCount = uploadedMatches.filter((m) => m.duprSubmissionStatus === 'failed').length;

  return (
    <Flex direction="column" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <Flex
        justify="between"
        align="center"
        px="6"
        style={{
          height: 64,
          backgroundColor: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          position: 'sticky', top: 0, zIndex: 50,
          gap: 12,
        }}
      >
        <Flex align="center" gap="3" style={{ minWidth: 0 }}>
          <Text weight="bold" size="3" style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.name}
          </Text>
          <Separator orientation="vertical" style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
          <Text size="2" style={{ color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{formatDate(event.eventDate)}</Text>
          {isUpcoming && <Badge size="1" color="blue" variant="soft">Upcoming</Badge>}
          {event.accessLevel === 'dupr_plus' && <Badge size="1" color="amber" variant="soft">DUPR+</Badge>}
        </Flex>
        {/* Add Matches only for past events — condition unchanged */}
        {!isUpcoming && (
          <Button
            onClick={() => setDrawerOpen(true)}
            radius="full"
            style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          >
            <PlusIcon /> Add Matches
          </Button>
        )}
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="6" style={{ maxWidth: 1200, margin: '0 auto' }}>

          <Breadcrumbs crumbs={[
            { label: 'My Clubs', href: '/admin/club' },
            { label: 'Events', href: `/admin/club/${clubId}/events` },
            { label: event.name },
          ]} />

          {/* ── UPCOMING EVENT VIEW — condition unchanged ── */}
          {isUpcoming && (
            <>
              {/* Stat cards */}
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <StatCard label="Registered" value={event.registrationCount} accent />
                {event.location && <StatCard label="Location" value={event.location} />}
                <StatCard label="Access" value={event.accessLevel === 'dupr_plus' ? 'DUPR+ only' : 'Open to all'} />
              </Box>

              {event.description && (
                <Box style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '12px 16px',
                }}>
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Description</Text>
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>{event.description}</Text>
                </Box>
              )}

              <Flex align="center" gap="2">
                <Heading size="5" style={{ color: '#fff' }}>Registrants</Heading>
                {registrations.length > 0 && (
                  <Text size="3" style={{ color: 'rgba(255,255,255,0.35)' }}>({registrations.length})</Text>
                )}
              </Flex>

              <DarkTableWrap>
                <Table.Root>
                  <Table.Header>
                    <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <Table.ColumnHeaderCell style={thStyle}>Name</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>Email</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={thStyle}>DUPR ID</Table.ColumnHeaderCell>
                      {event.accessLevel === 'dupr_plus' && (
                        <Table.ColumnHeaderCell style={thStyle}>DUPR+ Verified</Table.ColumnHeaderCell>
                      )}
                      <Table.ColumnHeaderCell style={thStyle}>Registered</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {registrations.length === 0 ? (
                      <Table.Row>
                        <Table.Cell colSpan={event.accessLevel === 'dupr_plus' ? 5 : 4}>
                          <Text style={{ color: 'rgba(255,255,255,0.3)' }} align="center" my="4" size="2">
                            No registrations yet.
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      registrations.map((r) => (
                        <Table.Row key={r._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                          <Table.Cell><Text size="2" weight="medium" style={{ color: '#fff' }}>{r.name}</Text></Table.Cell>
                          <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.email ?? '—'}</Text></Table.Cell>
                          <Table.Cell><Text size="2" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{r.duprId}</Text></Table.Cell>
                          {event.accessLevel === 'dupr_plus' && (
                            <Table.Cell>
                              <Flex align="center" gap="1">
                                <SyncIcon synced={r.duprPlusVerifiedAtRegistration} />
                                <Text size="2" style={{ color: r.duprPlusVerifiedAtRegistration ? '#84cc16' : 'rgba(255,255,255,0.35)' }}>
                                  {r.duprPlusVerifiedAtRegistration ? 'Verified' : 'Not verified'}
                                </Text>
                              </Flex>
                            </Table.Cell>
                          )}
                          <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDateTime(r.registeredAt)}</Text></Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table.Root>
              </DarkTableWrap>
            </>
          )}

          {/* ── PAST EVENT VIEW — condition unchanged ── */}
          {!isUpcoming && (
            <>
              {/* Stat grid */}
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
                  <Box style={{
                    background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.2)',
                    borderRadius: 10, padding: '12px 16px',
                  }}>
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
                      <Table.Row>
                        <Table.Cell colSpan={6}>
                          <Flex direction="column" align="center" py="7" gap="2">
                            <Upload size={24} color="rgba(255,255,255,0.2)" />
                            <Text size="2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              No matches yet. Click "Add Matches" to get started.
                            </Text>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      uploadedMatches.map((m) => (
                        <Table.Row key={m._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                          <Table.Cell><Text size="2" style={{ color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{formatDate(m.matchDate)}</Text></Table.Cell>
                          <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamA.player1.name} & {m.teamA.player2.name}</Text></Table.Cell>
                          <Table.Cell><Text size="2" style={{ color: '#fff' }}>{m.teamB.player1.name} & {m.teamB.player2.name}</Text></Table.Cell>
                          <Table.Cell>
                            <Text size="2" style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>
                              {formatScore(m.teamA, m.teamB)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              radius="full"
                              color={
                                m.duprSubmissionStatus === 'submitted' ? 'green' :
                                m.duprSubmissionStatus === 'failed' ? 'red' :
                                m.duprSubmissionStatus === 'pending' ? 'blue' : 'gray'
                              }
                            >
                              {m.duprSubmissionStatus}
                            </Badge>
                          </Table.Cell>
                          {/* Edit — disabled condition unchanged */}
                          <Table.Cell>
                            <IconButton size="1" variant="ghost" color="gray"
                              onClick={() => { setEditingMatch(m); setEditOpen(true); }}
                              disabled={m.duprSubmissionStatus !== 'submitted'}
                            >
                              <Pencil1Icon />
                            </IconButton>
                          </Table.Cell>
                          <Table.Cell>
                            <IconButton size="1" variant="ghost" color="red"
                              onClick={() => handleDelete(m._id)}
                            >
                              <TrashIcon />
                            </IconButton>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table.Root>
              </DarkTableWrap>

              {/* Player sync status — condition unchanged */}
              {syncData && syncData.matches.length > 0 && (
                <>
                  <Flex align="center" gap="3">
                    <Heading size="5" style={{ color: '#fff' }}>Player Sync Status</Heading>
                    {syncLoading && <Spinner size="1" />}
                  </Flex>
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.4)', marginTop: -12 }}>
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
                            <Table.Cell>
                              <Text size="2" style={{ color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                                {formatDate(m.matchDate)}
                              </Text>
                            </Table.Cell>
                            {[m.teamA.player1, m.teamA.player2, m.teamB.player1, m.teamB.player2].map((p, i) => (
                              <Table.Cell key={i}>
                                <Flex align="center" gap="2">
                                  <SyncIcon synced={p.synced} />
                                  <Text size="2" style={{ color: p.synced ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                                    {p.name}
                                  </Text>
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

      {/* Drawers — mount condition and props unchanged */}
      {!isUpcoming && (
        <>
          <UploadMatchesDrawer
            clubId={clubId}
            eventId={eventId}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onSubmitted={loadEvent}
          />
          <EditMatchDrawer
            match={editingMatch}
            open={editOpen}
            onOpenChange={setEditOpen}
            onUpdated={loadEvent}
          />
        </>
      )}
    </Flex>
  );
}