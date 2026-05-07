'use client';

import { useEffect, useState, useCallback, use } from 'react';
import {
  Badge, Button, Callout, Card, Flex, Spinner, Table, Text,
  Grid, Box, Heading, Separator, IconButton,
} from '@radix-ui/themes';
import { PlusIcon, TrashIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { DateTime } from 'luxon';
import { UploadMatchesDrawer } from '../../../components/UploadMatchesDrawer';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { EditMatchDrawer } from '../../../components/EditMatchDrawer';
import { Breadcrumbs } from '@/app/(ADMIN)/admin/components/Breadcrumbs';

interface PlayerWithSync {
  name: string;
  email?: string;
  duprId: string;
  synced: boolean;
}
interface TeamWithSync {
  player1: PlayerWithSync;
  player2: PlayerWithSync;
  game1: number; game2: number; game3: number; game4: number; game5: number;
}
interface SyncedMatchRow {
  _id: string;
  matchDate: string;
  duprMatchId: string;
  teamA: TeamWithSync;
  teamB: TeamWithSync;
}
interface SyncSummary {
  totalMatches: number;
  syncedMatches: number;
  totalPlayers: number;
  syncedPlayers: number;
}
interface UploadedMatchRow {
  _id: string;
  matchDate: string;
  teamA: any;
  teamB: any;
  duprSubmissionStatus: string;
  duprMatchId?: string;
}
interface RegistrantRow {
  _id: string;
  name: string;
  email?: string;
  duprId: string;
  duprPlusVerifiedAtRegistration: boolean;
  registeredAt: string;
}
interface EventDetail {
  _id: string;
  name: string;
  eventDate: string;
  eventType: 'past' | 'upcoming';
  accessLevel: 'open' | 'dupr_plus';
  location?: string;
  description?: string;
  registrationCount: number;
  notes?: string;
}

const formatDate = (s: string) => (s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—');
const formatDateTime = (s: string) =>
  s ? DateTime.fromISO(s).toFormat('MMM d, yyyy · h:mm a') : '—';

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

export default function EventDetailPage({ params }: { params: Promise<{ clubId: string; eventId: string }> }) {
  const { clubId, eventId } = use(params);

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
  useEffect(() => {
    if (uploadedMatches.some((m) => m.duprSubmissionStatus === 'submitted')) {
      loadSyncStatus();
    }
  }, [uploadedMatches, loadSyncStatus]);

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
    <Flex direction="column" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <Flex justify="between" align="center" height="64px" px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}>
        <Flex align="center" gap="4">
          <Text weight="bold" size="3">{event.name}</Text>
          <Separator orientation="vertical" style={{ height: 20 }} />
          <Text size="2" color="gray">{formatDate(event.eventDate)}</Text>
          {isUpcoming && (
            <Badge size="1" color="blue" variant="soft">Upcoming</Badge>
          )}
          {event.accessLevel === 'dupr_plus' && (
            <Badge size="1" color="amber" variant="soft">DUPR+</Badge>
          )}
        </Flex>
        {/* Only past events can have matches added */}
        {!isUpcoming && (
          <Button onClick={() => setDrawerOpen(true)}>
            <PlusIcon /> Add Matches
          </Button>
        )}
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="6" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Breadcrumbs crumbs={[
            { label: 'My Clubs', href: '/admin/club' },
            { label: 'Events', href: `/admin/club/${clubId}/events` },
            { label: event.name },
          ]} />

          {/* ── UPCOMING EVENT VIEW ─────────────────────────────────────────── */}
          {isUpcoming && (
            <>
              {/* Event info summary */}
              <Grid columns={{ initial: '2', sm: '3' }} gap="4">
                <Card size="2">
                  <Text size="2" color="gray">Registered: </Text>
                  <Text size="6" weight="bold">{event.registrationCount}</Text>
                </Card>
                {event.location && (
                  <Card size="2">
                    <Text size="2" color="gray">Location: </Text>
                    <Text size="3" weight="medium">{event.location}</Text>
                  </Card>
                )}
                <Card size="2">
                  <Text size="2" color="gray">Access: </Text>
                  <Text size="3" weight="medium">
                    {event.accessLevel === 'dupr_plus' ? 'DUPR+ only' : 'Open to all'}
                  </Text>
                </Card>
              </Grid>

              {event.description && (
                <Box>
                  <Text size="2" color="gray" mb="1">Description: </Text>
                  <Text size="2">{event.description}</Text>
                </Box>
              )}

              {/* Registrants table */}
              <Heading size="4">
                Registrants
                {registrations.length > 0 && (
                  <Text size="3" color="gray" ml="2" weight="regular">
                    ({registrations.length})
                  </Text>
                )}
              </Heading>

              <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>DUPR ID</Table.ColumnHeaderCell>
                      {event.accessLevel === 'dupr_plus' && (
                        <Table.ColumnHeaderCell>DUPR+ Verified</Table.ColumnHeaderCell>
                      )}
                      <Table.ColumnHeaderCell>Registered</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {registrations.length === 0 ? (
                      <Table.Row>
                        <Table.Cell colSpan={event.accessLevel === 'dupr_plus' ? 5 : 4}>
                          <Text color="gray" align="center" my="4">
                            No registrations yet.
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      registrations.map((r) => (
                        <Table.Row key={r._id}>
                          <Table.Cell>
                            <Text size="2" weight="medium">{r.name}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" color="gray">{r.email ?? '—'}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" style={{ fontFamily: 'monospace' }}>{r.duprId}</Text>
                          </Table.Cell>
                          {event.accessLevel === 'dupr_plus' && (
                            <Table.Cell>
                              <Flex align="center" gap="1">
                                <SyncIcon synced={r.duprPlusVerifiedAtRegistration} />
                                <Text size="2" color={r.duprPlusVerifiedAtRegistration ? undefined : 'gray'}>
                                  {r.duprPlusVerifiedAtRegistration ? 'Verified' : 'Not verified'}
                                </Text>
                              </Flex>
                            </Table.Cell>
                          )}
                          <Table.Cell>
                            <Text size="2" color="gray">{formatDateTime(r.registeredAt)}</Text>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table.Root>
              </Card>
            </>
          )}

          {/* ── PAST EVENT VIEW ─────────────────────────────────────────────── */}
          {!isUpcoming && (
            <>
              <Grid columns={{ initial: '2', sm: '4' }} gap="4">
                <Card size="2">
                  <Text size="2" mr="4" color="gray">Total Matches</Text>
                  <Text size="6" weight="bold">{uploadedMatches.length}</Text>
                </Card>
                <Card size="2">
                  <Text size="2" mr="4" color="gray">Submitted to DUPR</Text>
                  <Text size="6" weight="bold" color={submittedCount > 0 ? undefined : 'gray'}>
                    {submittedCount}
                  </Text>
                </Card>
                {syncData && (
                  <>
                    <Card size="2">
                      <Text size="2" mr="4" color="gray">Players Synced</Text>
                      <Text size="6" weight="bold">
                        {syncData.summary.syncedPlayers} / {syncData.summary.totalPlayers}
                      </Text>
                    </Card>
                    <Card size="2">
                      <Text size="2" mr="4" color="gray">Matches Synced</Text>
                      <Text size="6" weight="bold">
                        {syncData.summary.syncedMatches} / {syncData.summary.totalMatches}
                      </Text>
                    </Card>
                  </>
                )}
                {failedCount > 0 && (
                  <Card size="2">
                    <Text size="2" mr="4" color="red">Failed</Text>
                    <Text size="6" weight="bold" color="red">{failedCount}</Text>
                  </Card>
                )}
              </Grid>

              <Heading size="4">Matches</Heading>
              <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Team A</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Team B</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>DUPR Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {uploadedMatches.length === 0 ? (
                      <Table.Row>
                        <Table.Cell colSpan={6}>
                          <Text color="gray" align="center" my="4">
                            No matches yet. Click "Add Matches" to get started.
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      uploadedMatches.map((m) => (
                        <Table.Row key={m._id}>
                          <Table.Cell><Text size="2">{formatDate(m.matchDate)}</Text></Table.Cell>
                          <Table.Cell>
                            <Text size="2">{m.teamA.player1.name} & {m.teamA.player2.name}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2">{m.teamB.player1.name} & {m.teamB.player2.name}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="2" style={{ fontFamily: 'monospace' }}>
                              {formatScore(m.teamA, m.teamB)}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              color={
                                m.duprSubmissionStatus === 'submitted' ? 'green' :
                                m.duprSubmissionStatus === 'failed' ? 'red' :
                                m.duprSubmissionStatus === 'pending' ? 'blue' : 'gray'
                              }
                              radius="full"
                            >
                              {m.duprSubmissionStatus}
                            </Badge>
                          </Table.Cell>
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
                              onClick={() => handleDelete(m._id)}>
                              <TrashIcon />
                            </IconButton>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table.Root>
              </Card>

              {syncData && syncData.matches.length > 0 && (
                <>
                  <Heading size="4">Player Sync Status</Heading>
                  <Text size="2" color="gray" mb="2">
                    Shows which players have synced their DUPR account to pick up these matches.
                  </Text>
                  <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
                    <Table.Root variant="surface">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Match</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Team A - Player 1</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Team A - Player 2</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Team B - Player 1</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Team B - Player 2</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {syncData.matches.map((m) => (
                          <Table.Row key={m._id}>
                            <Table.Cell>
                              <Text size="2" color="gray">{formatDate(m.matchDate)}</Text>
                            </Table.Cell>
                            {[m.teamA.player1, m.teamA.player2, m.teamB.player1, m.teamB.player2].map((p, i) => (
                              <Table.Cell key={i}>
                                <Flex align="center" gap="2">
                                  <SyncIcon synced={p.synced} />
                                  <Text size="2">{p.name}</Text>
                                </Flex>
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Card>
                  {syncLoading && <Flex justify="center" p="2"><Spinner size="1" /></Flex>}
                </>
              )}
            </>
          )}
        </Flex>
      </Box>

      {/* Drawers only mount for past events */}
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