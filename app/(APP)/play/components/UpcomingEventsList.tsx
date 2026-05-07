'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Card, Flex, Spinner, Text, Badge, Heading,
} from '@radix-ui/themes';
import { DateTime } from 'luxon';
import { CalendarIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { MapPin, Lock } from 'lucide-react';
import { FrontendUser } from '@/app/types/frontendTypes';

// TODO: When DuprConnectModal is extracted as a shared component, replace the
// onInitiateDuprLogin prop with a direct import and remove the prop entirely.
// Tracked in: "Refactor /play page — migrate inline DUPR connect to shared
// DuprConnectModal" (see DEVELOPER_REFERENCE.md Known Limitations).

interface UpcomingEvent {
  _id: string;
  name: string;
  eventDate: string;
  eventType: 'upcoming';
  accessLevel: 'open' | 'dupr_plus';
  location?: string;
  description?: string;
  registrationCount: number;
  isRegistered: boolean;
  club: { _id: string; name: string };
}

interface UpcomingEventsListProps {
  dbUser: FrontendUser | null;
  authenticationStatus: 'loading' | 'authenticated' | 'guest' | 'anonymous';
  onInitiateDuprLogin: () => void;
}

const LIMIT = 10;

// TODO: Confirm the actual DUPR+ upgrade URL with DUPR and update this constant.
const DUPR_PLUS_UPGRADE_URL = 'https://dashboard.dupr.com/dashboard/subscription';

const formatEventDate = (iso: string) =>
  DateTime.fromISO(iso).toFormat('EEE, MMM d · h:mm a');

export function UpcomingEventsList({
  dbUser,
  authenticationStatus,
  onInitiateDuprLogin,
}: UpcomingEventsListProps) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which event IDs are mid-registration so we can show per-card loading.
  const [registering, setRegistering] = useState<Set<string>>(new Set());
  // Track per-card registration errors without blowing up the whole list.
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  const fetchEvents = useCallback(async (pageNum: number, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/upcoming?page=${pageNum}&limit=${LIMIT}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load events');
      setEvents((prev) => append ? [...prev, ...data.events] : data.events);
      setTotalPages(data.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Don't fetch until we know auth status — avoids a flash of the
    // "connect DUPR" state before the user doc is resolved.
    if (authenticationStatus === 'loading') return;
    // Guests and anonymous users can't register, but we still show the feed
    // so they can see what's available and feel prompted to sign up.
    fetchEvents(1, false);
  }, [authenticationStatus, fetchEvents]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEvents(nextPage, true);
  };

  const handleRegister = async (eventId: string) => {
    setRegistering((prev) => new Set(prev).add(eventId));
    setRegisterErrors((prev) => { const next = { ...prev }; delete next[eventId]; return next; });

    try {
      const res = await fetch(`/api/events/${eventId}/register`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Registration failed');

      // Optimistically update the card to "registered" state and bump the count.
      setEvents((prev) =>
        prev.map((ev) =>
          ev._id === eventId
            ? { ...ev, isRegistered: true, registrationCount: ev.registrationCount + 1 }
            : ev
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.';
      setRegisterErrors((prev) => ({ ...prev, [eventId]: msg }));
    } finally {
      setRegistering((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const isDuprConnected = Boolean(dbUser?.dupr?.id);
  const hasPremium = Boolean(dbUser?.dupr?.hasPremiumEntitlement);

  const getButtonState = (ev: UpcomingEvent): 'registered' | 'register' | 'needs-dupr' | 'needs-plus' => {
    if (ev.isRegistered) return 'registered';
    if (!isDuprConnected) return 'needs-dupr';
    if (ev.accessLevel === 'dupr_plus' && !hasPremium) return 'needs-plus';
    return 'register';
  };

  // Don't render the section at all if there are no events and we're done loading.
  if (!loading && events.length === 0 && !error) return null;

  return (
    <Box mb="8">
      <Flex align="baseline" gap="3" mb="4">
        <Heading
          size="5"
          style={{ color: 'var(--slate-12)', letterSpacing: '-0.01em' }}
        >
          Upcoming Events
        </Heading>
      </Flex>

      {loading && (
        <Flex justify="center" py="8">
          <Spinner size="3" />
        </Flex>
      )}

      {error && (
        <Card style={{ borderRadius: '16px', padding: '24px' }}>
          <Text size="2" color="red" align="center">{error}</Text>
        </Card>
      )}

      {!loading && (
        <Flex direction="column" gap="3">
          {events.map((ev) => {
            const buttonState = getButtonState(ev);
            const isRegistering = registering.has(ev._id);
            const cardError = registerErrors[ev._id];

            return (
              <Card
                key={ev._id}
                style={{
                  borderRadius: '16px',
                  padding: '20px',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  border: ev.isRegistered
                    ? '1px solid var(--green-6)'
                    : '1px solid var(--gray-4)',
                }}
              >
                <Flex justify="between" align="start" gap="4">
                  {/* Left: event info */}
                  <Flex direction="column" gap="2" style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>
                        {ev.name}
                      </Text>
                      {ev.accessLevel === 'dupr_plus' && (
                        <Badge size="1" color="amber" variant="soft">DUPR+</Badge>
                      )}
                      {ev.isRegistered && (
                        <Badge size="1" color="green" variant="soft">Registered</Badge>
                      )}
                    </Flex>

                    <Text size="2" color="gray">{ev.club.name}</Text>

                    <Flex align="center" gap="1">
                      <CalendarIcon width="13" height="13" color="var(--gray-9)" />
                      <Text size="2" color="gray">{formatEventDate(ev.eventDate)}</Text>
                    </Flex>

                    {ev.location && (
                      <Flex align="center" gap="1">
                        <MapPin size={13} color="var(--gray-9)" />
                        <Text size="2" color="gray">{ev.location}</Text>
                      </Flex>
                    )}

                    {ev.description && (
                      <Text
                        size="2"
                        color="gray"
                        style={{
                          marginTop: '2px',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {ev.description}
                      </Text>
                    )}

                    {cardError && (
                      <Text size="1" color="red" mt="1">{cardError}</Text>
                    )}
                  </Flex>

                  {/* Right: action */}
                  <Flex direction="column" align="end" gap="2" style={{ flexShrink: 0 }}>
                    {buttonState === 'registered' && (
                      <Flex align="center" gap="1">
                        <CheckCircledIcon color="var(--green-9)" width="16" height="16" />
                        <Text size="2" weight="medium" style={{ color: 'var(--green-11)' }}>
                          You're in
                        </Text>
                      </Flex>
                    )}

                    {buttonState === 'register' && (
                      <Button
                        size="2"
                        radius="full"
                        onClick={() => handleRegister(ev._id)}
                        disabled={isRegistering}
                        style={{
                          backgroundColor: 'var(--slate-12)',
                          color: 'white',
                          fontWeight: 'bold',
                          cursor: isRegistering ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isRegistering ? <Spinner size="1" /> : 'Register'}
                      </Button>
                    )}

                    {buttonState === 'needs-dupr' && (
                      <Flex direction="column" align="end" gap="1">
                        <Button
                          size="2"
                          radius="full"
                          onClick={onInitiateDuprLogin}
                          style={{
                            backgroundColor: 'var(--lime-9)',
                            color: 'var(--slate-12)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          Connect DUPR to Register
                        </Button>
                      </Flex>
                    )}

                    {buttonState === 'needs-plus' && (
                      <Flex direction="column" align="end" gap="1">
                        <Button
                          size="2"
                          radius="full"
                          disabled
                          style={{ cursor: 'not-allowed', opacity: 0.6 }}
                        >
                          <Lock size={13} />
                          DUPR+ Required
                        </Button>
                        <Text
                          size="1"
                          style={{
                            color: 'var(--amber-11)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() => window.open(DUPR_PLUS_UPGRADE_URL, '_blank')}
                        >
                          Upgrade to DUPR+
                        </Text>
                      </Flex>
                    )}

                    <Text size="1" color="gray">
                      {ev.registrationCount} registered
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            );
          })}

          {page < totalPages && (
            <Flex justify="center" pt="2">
              <Button
                variant="soft"
                color="gray"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <Spinner size="1" /> : 'Load more events'}
              </Button>
            </Flex>
          )}
        </Flex>
      )}
    </Box>
  );
}