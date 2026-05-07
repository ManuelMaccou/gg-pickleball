'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, Flex, Spinner, Text, Box, Heading,
  Separator, Dialog, TextField, Callout, Table, TextArea, Switch,
} from '@radix-ui/themes';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DateTime } from 'luxon';
import { Breadcrumbs } from '../../../components/Breadcrumbs';

interface ClubEventRow {
  _id: string;
  name: string;
  eventDate: string;
  eventType: 'past' | 'upcoming';
  accessLevel: 'open' | 'dupr_plus';
  location?: string;
  description?: string;
  registrationCount: number;
  notes?: string;
  createdAt: string;
}

type EventTypeChoice = 'past' | 'upcoming' | null;

const formatDate = (s: string) => (s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—');

const today = new Date().toISOString().slice(0, 10);

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

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTypeChoice, setEventTypeChoice] = useState<EventTypeChoice>(null);

  // Shared fields
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(today);
  const [newNotes, setNewNotes] = useState('');

  // Upcoming-only fields
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [duprPlusOnly, setDuprPlusOnly] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    setEventTypeChoice(null);
    setNewName('');
    setNewDate(today);
    setNewNotes('');
    setNewLocation('');
    setNewDescription('');
    setDuprPlusOnly(false);
    setCreateError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) resetDialog();
    setCreateOpen(open);
  };

  const handleCreate = async () => {
    if (!eventTypeChoice) return;
    if (!newName.trim()) return setCreateError('Event name is required.');
    if (!newDate) return setCreateError('Date is required.');

   



    if (eventTypeChoice === 'upcoming') {
    const todayString = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()); // "2026-04-30" in whatever timezone the browser is in

    console.log('new date:', newDate)
    console.log('todayString:', todayString)
    
    if (newDate < todayString) {
      return setCreateError('Upcoming events must be scheduled for today or a future date.');
    }
  }

    setCreating(true);
    setCreateError(null);

    try {
      const body: Record<string, unknown> = {
        clubId,
        name: newName.trim(),
        eventDate: newDate,
        eventType: eventTypeChoice,
        notes: newNotes.trim() || undefined,
      };

      if (eventTypeChoice === 'upcoming') {
        body.accessLevel = duprPlusOnly ? 'dupr_plus' : 'open';
        body.location = newLocation.trim() || undefined;
        body.description = newDescription.trim() || undefined;
      }

      const res = await fetch('/api/club/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreateOpen(false);
      resetDialog();
      router.push(`/admin/club/${clubId}/events/${data.event._id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  if (authError) return <Flex justify="center" p="9"><Text color="red">{authError}</Text></Flex>;
  if (!club) return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;

  return (
    <Flex direction="column" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <Flex justify="between" align="center" height="64px" px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}>
        <Flex align="center" gap="4">
          <Text weight="bold" size="3">Club Events</Text>
          <Separator orientation="vertical" style={{ height: 20 }} />
          <Badge size="2" color="gray" variant="surface">{club.name}</Badge>
        </Flex>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New Event
        </Button>
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="6" style={{ maxWidth: 900, margin: '0 auto' }}>
          <Breadcrumbs crumbs={[
            { label: 'My Clubs', href: '/admin/club' },
            { label: club.name },
          ]} />
          <Heading size="6">Events</Heading>

          {error && <Callout.Root color="red"><Callout.Text>{error}</Callout.Text></Callout.Root>}

          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Event Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row>
                    <Table.Cell colSpan={3}>
                      <Flex justify="center" p="4"><Spinner /></Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : events.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={3}>
                      <Text color="gray" align="center" my="4">
                        No events yet. Create one to get started.
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  events.map((ev) => (
                    <Table.Row key={ev._id} style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/admin/club/${clubId}/events/${ev._id}`)}>
                      <Table.Cell>
                        <Flex direction={{initial: 'column', md: 'row'}} gap={'2'} wrap={'wrap'}>
                          <Flex align="center" gap="2">
                            <Text size="2" weight="medium">{ev.name}</Text>
                          </Flex>
                      
                          <Flex align="center" gap="2">
                            {ev.eventType === 'upcoming' && (
                              <Badge size="1" color="blue" variant="soft">Upcoming</Badge>
                            )}
                            {ev.accessLevel === 'dupr_plus' && (
                              <Badge size="1" color="amber" variant="soft">DUPR+</Badge>
                            )}
                          </Flex>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex minWidth={'fit-content'}>
                          <Text size="2" color="gray">{formatDate(ev.eventDate)}</Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Button variant="soft" size="1">View</Button>
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
                <Button variant="soft" color="gray" disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeftIcon /> Prev
                </Button>
                <Button variant="soft" color="gray" disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next <ChevronRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      </Box>

      {/* Create Event Dialog */}
      <Dialog.Root open={createOpen} onOpenChange={handleDialogOpenChange}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Create Event</Dialog.Title>

          {createError && (
            <Callout.Root color="red" mb="3">
              <Callout.Text>{createError}</Callout.Text>
            </Callout.Root>
          )}

          {/* Step 1: Event type choice */}
          {!eventTypeChoice && (
            <>
              <Dialog.Description size="2" color="gray" mb="4">
                What kind of event would you like to create?
              </Dialog.Description>
              <Flex direction="column" gap="3">
                <Card
                  style={{ cursor: 'pointer', border: '1px solid var(--gray-5)' }}
                  onClick={() => setEventTypeChoice('past')}
                >
                  <Flex direction="column" gap="1" p="2">
                    <Text size="2" weight="bold">Log a completed event</Text>
                    <Text size="2" color="gray">
                      Record results from a match day that's already happened and submit them to DUPR.
                    </Text>
                  </Flex>
                </Card>
                <Card
                  style={{ cursor: 'pointer', border: '1px solid var(--gray-5)' }}
                  onClick={() => {
                    setEventTypeChoice('upcoming');
                    setNewDate(today);
                  }}
                >
                  <Flex direction="column" gap="1" p="2">
                    <Text size="2" weight="bold">Schedule an upcoming event</Text>
                    <Text size="2" color="gray">
                      Publish an event players can discover and register for on the app.
                    </Text>
                  </Flex>
                </Card>
              </Flex>
              <Flex justify="end" mt="4">
                <Button variant="soft" color="gray" onClick={() => handleDialogOpenChange(false)}>
                  Cancel
                </Button>
              </Flex>
            </>
          )}

          {/* Step 2: Shared + type-specific fields */}
          {eventTypeChoice && (
            <>
              <Dialog.Description size="2" color="gray" mb="4">
                {eventTypeChoice === 'past'
                  ? "Fill in the details. You'll add matches on the next screen."
                  : 'Fill in the details. Players will see this event on the app once published.'}
              </Dialog.Description>

              <Flex direction="column" gap="3">
                {/* Shared fields */}
                <Box>
                  <Text size="1" color="gray" mb="1">Event name</Text>
                  <TextField.Root
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Tuesday Night Round Robin"
                  />
                </Box>
                <Box>
                  <Text size="1" color="gray" mb="1">
                    {eventTypeChoice === 'past' ? 'Date' : 'Event date'}
                  </Text>
                  <TextField.Root
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </Box>

                {/* Upcoming-only fields */}
                {eventTypeChoice === 'upcoming' && (
                  <>
                    <Box>
                      <Text size="1" color="gray" mb="1">Location (optional)</Text>
                      <TextField.Root
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="e.g. Elmwood Pickleball Center, Court 3"
                      />
                    </Box>
                    <Box>
                      <Text size="1" color="gray" mb="1">Description (optional)</Text>
                      <TextArea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Format, skill level, what to bring, etc."
                        rows={3}
                      />
                    </Box>
                    <Box>
                      <Text size="1" color="gray" mb="1">Notes (optional)</Text>
                      <TextField.Root
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Internal notes — not visible to players"
                      />
                    </Box>
                    <Flex
                      align="center"
                      justify="between"
                      p="3"
                      style={{ borderRadius: 'var(--radius-3)', backgroundColor: 'var(--amber-2)', border: '1px solid var(--amber-6)' }}
                    >
                      <Box>
                        <Text size="2" weight="medium">DUPR+ members only: </Text>
                        <Text size="1" color="gray" mt="1">
                          Players will need an active DUPR+ subscription to register.
                        </Text>
                      </Box>
                      <Switch
                        checked={duprPlusOnly}
                        onCheckedChange={setDuprPlusOnly}
                        color="amber"
                      />
                    </Flex>
                  </>
                )}

                {/* Past event notes */}
                {eventTypeChoice === 'past' && (
                  <Box>
                    <Text size="1" color="gray" mb="1">Notes (optional)</Text>
                    <TextField.Root
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Any additional details"
                    />
                  </Box>
                )}
              </Flex>

              <Flex gap="3" justify="between" mt="5">
                <Button
                  variant="ghost"
                  color="gray"
                  onClick={() => {
                    setEventTypeChoice(null);
                    setCreateError(null);
                  }}
                >
                  ← Back
                </Button>
                <Flex gap="3">
                  <Button variant="soft" color="gray" onClick={() => handleDialogOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating
                      ? 'Creating…'
                      : eventTypeChoice === 'past'
                        ? 'Create & Add Matches'
                        : 'Publish Event'}
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}