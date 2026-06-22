'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Flex, Spinner, Text, Box, Heading,
  Separator, Dialog, TextField, Callout, Table, TextArea, Switch,
} from '@radix-ui/themes';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, ReloadIcon } from '@radix-ui/react-icons';
import { ArrowLeft, ArrowRight, Calendar, AlertCircle } from 'lucide-react';
import { DateTime } from 'luxon';
import { Breadcrumbs } from '../../../components/Breadcrumbs';

interface ClubEventRow {
  _id: string; name: string; eventDate: string;
  eventType: 'past' | 'upcoming'; accessLevel: 'open' | 'dupr_plus';
  location?: string; description?: string; registrationCount: number;
  notes?: string; createdAt: string;
}

type EventTypeChoice = 'past' | 'upcoming' | null;

// Display dates in PT
const formatDate = (s: string) =>
  s ? DateTime.fromISO(s).setZone('America/Los_Angeles').toFormat('MMM d, yyyy') : '—';

const formatDateTime = (s: string) =>
  s ? DateTime.fromISO(s).setZone('America/Los_Angeles').toFormat('MMM d, yyyy · h:mm a') : '—';

// Today's date string in PT
const todayInPT = () =>
  DateTime.now().setZone('America/Los_Angeles').toFormat('yyyy-MM-dd');

// Default time for new events
const DEFAULT_TIME = '18:00';

export default function ClubEventsPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params);
  const router = useRouter();

  const [club, setClub] = useState<{ _id: string; name: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [events, setEvents] = useState<ClubEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Create dialog state ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTypeChoice, setEventTypeChoice] = useState<EventTypeChoice>(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(todayInPT());
  const [newTime, setNewTime] = useState(DEFAULT_TIME);
  const [newNotes, setNewNotes] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [duprPlusOnly, setDuprPlusOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Publish confirmation state ─────────────────────────────────────────────
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/club/${clubId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Access denied');
        setClub(data.club);
      })
      .catch((e) => setAuthError(e.message));
  }, [clubId]);

  const loadEvents = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/club/events?clubId=${club._id}&page=${page}&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvents(data.events);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading events');
    } finally {
      setLoading(false);
    }
  }, [club, page]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const resetDialog = () => {
    setEventTypeChoice(null); setNewName('');
    setNewDate(todayInPT()); setNewTime(DEFAULT_TIME);
    setNewNotes(''); setNewLocation(''); setNewDescription('');
    setDuprPlusOnly(false); setCreateError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) resetDialog();
    setCreateOpen(open);
  };

  // ── Build PT datetime string for API ──────────────────────────────────────
  // Combines the date and time fields into a PT-aware ISO string so Mongoose
  // stores the correct UTC timestamp regardless of server timezone.
  const buildEventDateTime = (date: string, time: string): string => {
    const dt = DateTime.fromISO(`${date}T${time}`, { zone: 'America/Los_Angeles' });
    return dt.toISO()!;
  };

  const validateAndOpenConfirm = () => {
    if (!newName.trim()) { setCreateError('Event name is required.'); return; }
    if (!newDate) { setCreateError('Date is required.'); return; }
    if (!newTime) { setCreateError('Time is required.'); return; }

    if (eventTypeChoice === 'upcoming') {
      const todayPT = DateTime.now().setZone('America/Los_Angeles').startOf('day');
      const selectedPT = DateTime.fromISO(`${newDate}T${newTime}`, { zone: 'America/Los_Angeles' });
      if (selectedPT < todayPT) {
        setCreateError('Upcoming events must be scheduled for today or a future date.');
        return;
      }
    }

    setCreateError(null);
    setPublishConfirmOpen(true);
  };

  const handleCreate = async () => {
    if (!eventTypeChoice) return;
    setCreating(true);
    setCreateError(null);
    try {
      const eventDate = buildEventDateTime(newDate, newTime);
      const body: Record<string, unknown> = {
        clubId, name: newName.trim(), eventDate,
        eventType: eventTypeChoice, notes: newNotes.trim() || undefined,
      };
      if (eventTypeChoice === 'upcoming') {
        body.accessLevel = duprPlusOnly ? 'dupr_plus' : 'open';
        body.location = newLocation.trim() || undefined;
        body.description = newDescription.trim() || undefined;
      }
      const res = await fetch('/api/club/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPublishConfirmOpen(false);
      setCreateOpen(false);
      resetDialog();
      router.push(`/admin/club/${clubId}/events/${data.event._id}`);
    } catch (e) {
      setPublishConfirmOpen(false);
      setCreateError(e instanceof Error ? e.message : 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

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
        <Spinner style={{ color: '#a3e635' }} size="3" />
      </Flex>
    );
  }

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
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Flex align="center" gap="3">
          <Text weight="bold" size="3" style={{ color: '#fff' }}>Club Events</Text>
          <Separator orientation="vertical" style={{ height: 16, backgroundColor: 'rgba(255,255,255,0.12)' }} />
          <Badge size="2" variant="surface" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
            {club.name}
          </Badge>
        </Flex>
        <Button onClick={() => setCreateOpen(true)} radius="full"
          style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}>
          <PlusIcon /> New Event
        </Button>
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="5" style={{ maxWidth: 900, margin: '0 auto' }}>
          <Breadcrumbs crumbs={[{ label: 'My Clubs', href: '/admin/club' }, { label: club.name }]} />
          <Heading size="6" style={{ color: '#fff' }}>Events</Heading>

          {error && (
            <Callout.Root color="red">
              <Flex justify="between" align="center" gap="4" style={{ flex: 1 }}>
                <Callout.Text>{error}</Callout.Text>
                <Button size="1" variant="soft" color="red" onClick={loadEvents} style={{ flexShrink: 0, cursor: 'pointer' }}>
                  <ReloadIcon /> Try again
                </Button>
              </Flex>
            </Callout.Root>
          )}

          <Box style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <Table.Root>
              <Table.Header>
                <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <Table.ColumnHeaderCell style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Event Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Date & Time</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row><Table.Cell colSpan={4}><Flex justify="center" p="5"><Spinner style={{ color: '#a3e635' }} /></Flex></Table.Cell></Table.Row>
                ) : events.length === 0 ? (
                  <Table.Row><Table.Cell colSpan={4}>
                    <Flex direction="column" align="center" py="7" gap="2">
                      <Calendar size={24} color="rgba(255,255,255,0.2)" />
                      <Text style={{ color: 'rgba(255,255,255,0.7)' }} size="2">No events yet. Create one to get started.</Text>
                    </Flex>
                    <Flex justify="center" mb="5">
                      <Button onClick={() => setCreateOpen(true)} radius="full"
                        style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}>
                        <PlusIcon /> New Event
                      </Button>
                    </Flex>
                  </Table.Cell></Table.Row>
                ) : (
                  events.map((ev) => (
                    <Table.Row key={ev._id} style={{ cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
                      onClick={() => router.push(`/admin/club/${clubId}/events/${ev._id}`)}>
                      <Table.Cell style={{ padding: '12px 16px' }}>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text size="2" weight="medium" style={{ color: '#fff' }}>{ev.name}</Text>
                          {ev.eventType === 'upcoming' && <Badge size="1" color="blue" variant="soft">Upcoming</Badge>}
                          {ev.accessLevel === 'dupr_plus' && <Badge size="1" color="amber" variant="soft">DUPR+</Badge>}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell style={{ padding: '12px 16px' }}>
                        <Text size="2" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(ev.eventDate)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ padding: '12px 16px' }}>
                        <Flex align="center" gap="1" justify="end">
                          <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>View</Text>
                          <ArrowRight size={14} color="rgba(255,255,255,0.8)" />
                        </Flex>
                      </Table.Cell>

                    </Table.Row>
                  ))
                )}
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

      {/* ── Create Event Dialog ── */}
      <Dialog.Root open={createOpen} onOpenChange={handleDialogOpenChange}>
        <Dialog.Content style={{ maxWidth: 500, backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <Dialog.Title style={{ color: '#fff' }}>Create Event</Dialog.Title>
          {createError && <Callout.Root color="red" mb="3"><Callout.Text>{createError}</Callout.Text></Callout.Root>}

          {!eventTypeChoice && (
            <>
              <Dialog.Description size="2" mb="4" style={{ color: 'rgba(255,255,255,0.8)' }}>What kind of event would you like to create?</Dialog.Description>
              <Flex direction="column" gap="3">
                {[
                  { type: 'past' as const, title: 'Log a completed event', description: "Record results from a match day that's already happened and submit them to DUPR." },
                  { type: 'upcoming' as const, title: 'Schedule an upcoming event', description: 'Publish an event players can discover and register for on the app.' },
                ].map(({ type, title, description }) => (
                  <Box key={type} onClick={() => { setEventTypeChoice(type); if (type === 'upcoming') { setNewDate(todayInPT()); setNewTime(DEFAULT_TIME); } }}
                    style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', transition: 'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(163,230,53,0.4)'; e.currentTarget.style.background = 'rgba(163,230,53,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                    <Text size="2" weight="bold" style={{ color: '#fff', display: 'block', marginBottom: 4 }}>{title}</Text>
                    <Text size="2" style={{ color: 'rgba(255,255,255,0.8)' }}>{description}</Text>
                  </Box>
                ))}
              </Flex>
              <Flex justify="end" mt="4"><Button variant="soft" color="gray" onClick={() => handleDialogOpenChange(false)}>Cancel</Button></Flex>
            </>
          )}

          {eventTypeChoice && (
            <>
              <Dialog.Description size="2" mb="4" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {eventTypeChoice === 'past' ? "Fill in the details. You'll add matches on the next screen." : 'Fill in the details. Review before publishing.'}
              </Dialog.Description>
              <Flex direction="column" gap="3">
                <Box>
                  <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>Event name</Text>
                  <TextField.Root value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Tuesday Night Round Robin" />
                </Box>

                {/* Date + Time side by side */}
                <Flex gap="3">
                  <Box style={{ flex: 1 }}>
                    <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>
                      {eventTypeChoice === 'past' ? 'Date' : 'Event date'} <Text size="1" style={{ color: 'rgba(255,255,255,0.4)' }}>(PT)</Text>
                    </Text>
                    <TextField.Root type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </Box>
                  {eventTypeChoice === 'upcoming' && (
                    <Box style={{ flex: 1 }}>
                      <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>
                        Start time <Text size="1" style={{ color: 'rgba(255,255,255,0.4)' }}>(PT)</Text>
                      </Text>
                      <TextField.Root type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    </Box>
                  )}
                </Flex>

                {eventTypeChoice === 'upcoming' && (
                  <>
                    <Box>
                      <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>Location (optional)</Text>
                      <TextField.Root value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Elmwood Pickleball Center, Court 3" />
                    </Box>
                    <Box>
                      <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>Description (optional)</Text>
                      <TextArea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Format, skill level, what to bring, etc." rows={3} />
                    </Box>
                    <Box>
                      <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>Notes (optional)</Text>
                      <TextField.Root value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Internal notes — not visible to players" />
                    </Box>
                    <Flex align="center" justify="between" p="3" style={{ borderRadius: 8, backgroundColor: 'rgb(11, 108, 245, 0.8)', border: '0.5px solid rgba(245,158,11,0.25)' }}>
                      <Box>
                        <Text size="2" weight="medium" style={{ color: '#fff' }}>DUPR+ members only</Text>
                        <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 2 }}>Players will need an active DUPR+ subscription to register.</Text>
                      </Box>
                      <Switch checked={duprPlusOnly} onCheckedChange={setDuprPlusOnly} color="amber" />
                    </Flex>
                  </>
                )}
                {eventTypeChoice === 'past' && (
                  <Box>
                    <Text size="1" mb="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>Notes (optional)</Text>
                    <TextField.Root value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Any additional details" />
                  </Box>
                )}
              </Flex>
              <Flex gap="3" justify="between" mt="5">
                <Button variant="ghost" color="gray" onClick={() => { setEventTypeChoice(null); setCreateError(null); }}>
                  <ArrowLeft size={14} /> Back
                </Button>
                <Flex gap="3">
                  <Button variant="soft" color="gray" onClick={() => handleDialogOpenChange(false)}>Cancel</Button>
                  <Button
                    onClick={eventTypeChoice === 'upcoming' ? validateAndOpenConfirm : handleCreate}
                    disabled={creating}
                    style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: creating ? 'default' : 'pointer' }}
                  >
                    {creating ? 'Creating…' : eventTypeChoice === 'past' ? 'Create & Add Matches' : 'Review & Publish'}
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>

      {/* ── Publish confirmation dialog ── */}
      <Dialog.Root open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <Dialog.Content style={{ maxWidth: 440, backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <Dialog.Title style={{ color: '#fff' }}>Ready to publish?</Dialog.Title>
          <Dialog.Description size="2" mb="4" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Once published, this event will be visible to players immediately.
            Events cannot be edited after publishing. Make sure the details are correct.
          </Dialog.Description>

          {/* Summary card */}
          <Flex direction="column" gap="2" mb="5" style={{
            background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <Flex justify="between">
              <Text size="2" style={{ color: 'rgba(255,255,255,0.4)' }}>Name</Text>
              <Text size="2" style={{ color: '#fff' }} weight="medium">{newName}</Text>
            </Flex>
            <Flex justify="between">
              <Text size="2" style={{ color: 'rgba(255,255,255,0.4)' }}>Date & time</Text>
              <Text size="2" style={{ color: '#fff' }}>
                {newDate && newTime
                  ? DateTime.fromISO(`${newDate}T${newTime}`, { zone: 'America/Los_Angeles' }).toFormat('MMM d, yyyy · h:mm a') + ' PT'
                  : '—'}
              </Text>
            </Flex>
            {newLocation && (
              <Flex justify="between">
                <Text size="2" style={{ color: 'rgba(255,255,255,0.4)' }}>Location</Text>
                <Text size="2" style={{ color: '#fff' }}>{newLocation}</Text>
              </Flex>
            )}
            <Flex justify="between">
              <Text size="2" style={{ color: 'rgba(255,255,255,0.4)' }}>Access</Text>
              <Text size="2" style={{ color: '#fff' }}>{duprPlusOnly ? 'DUPR+ only' : 'Open to all'}</Text>
            </Flex>
          </Flex>

          <Flex gap="3" justify="between">
            <Button variant="soft" onClick={() => setPublishConfirmOpen(false)} style={{ cursor: 'pointer' }}>
              Go back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}
            >
              {creating ? 'Publishing…' : 'Publish event'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </Flex>
  );
}