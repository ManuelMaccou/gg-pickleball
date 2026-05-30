'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Flex, Spinner, Text, Badge, Heading,
} from '@radix-ui/themes';
import { DateTime } from 'luxon';
import { CalendarIcon, CheckCircledIcon, EnvelopeClosedIcon } from '@radix-ui/react-icons';
import { MapPin, Lock } from 'lucide-react';
import { FrontendUser } from '@/app/types/frontendTypes';

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
  cancelled?: boolean;
  clubOwnerEmail?: string | null;
  club: { _id: string; name: string };
}

interface UpcomingEventsListProps {
  dbUser: FrontendUser | null;
  authenticationStatus: 'loading' | 'authenticated' | 'guest' | 'anonymous';
  onInitiateDuprLogin: () => void;
}

const LIMIT = 10;
const DUPR_PLUS_UPGRADE_URL = 'https://dashboard.dupr.com/dashboard/subscription';

// ── Style tokens — matches /play dark theme ───────────────────────────────────
const LIME        = '#a3e635';
const LIME_DIM    = 'rgba(163,230,53,0.1)';
const LIME_BORDER = 'rgba(163,230,53,0.2)';
const CARD_BG     = '#111111';
const BORDER      = 'rgba(255,255,255,0.08)';
const TEXT_MUTED  = 'rgba(255,255,255,0.4)';
const TEXT_DIM    = 'rgba(255,255,255,0.6)';

const formatEventDate = (iso: string) =>
  DateTime.fromISO(iso).setZone('America/Los_Angeles').toFormat('EEE, MMM d · h:mm a') + ' PT';

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
  const [registering, setRegistering] = useState<Set<string>>(new Set());
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
    if (authenticationStatus === 'loading') return;
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
      setRegistering((prev) => { const next = new Set(prev); next.delete(eventId); return next; });
    }
  };

  const isDuprConnected = Boolean(dbUser?.dupr?.id);
  const hasPremium = Boolean(dbUser?.dupr?.hasPremiumEntitlement);

  const getButtonState = (ev: UpcomingEvent): 'cancelled' | 'registered' | 'register' | 'needs-dupr' | 'needs-plus' => {
    if (ev.cancelled) return 'cancelled';
    if (ev.isRegistered) return 'registered';
    if (!isDuprConnected) return 'needs-dupr';
    if (ev.accessLevel === 'dupr_plus' && !hasPremium) return 'needs-plus';
    return 'register';
  };

  if (!loading && events.length === 0 && !error) return null;

  return (
    <Box mb="8">
      {/* Section header — matches Rewards Catalog and Recent Games headers */}
      <Flex align="center" gap="3" mb="5">
        <Flex align="center" justify="center" style={{
          width: 36, height: 36, borderRadius: 10,
          background: LIME_DIM, border: `0.5px solid ${LIME_BORDER}`,
        }}>
          <CalendarIcon width="18" height="18" color={LIME} />
        </Flex>
        <Box>
          <Heading size="5" style={{ color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
            Upcoming Events
          </Heading>
          <Text size="2" style={{ color: TEXT_MUTED, display: 'block', marginTop: 2 }}>
            Register for events at clubs near you
          </Text>
        </Box>
      </Flex>

      {loading && (
        <Flex justify="center" py="8">
          <Spinner size="3" style={{ color: LIME }} />
        </Flex>
      )}

      {error && (
        <Box style={{
          background: 'rgba(239,68,68,0.08)',
          border: '0.5px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <Text size="2" style={{ color: '#f87171' }}>{error}</Text>
        </Box>
      )}

      {!loading && (
        <Flex direction="column" gap="3">
          {events.map((ev) => {
            const buttonState = getButtonState(ev);
            const isRegistering = registering.has(ev._id);
            const cardError = registerErrors[ev._id];
            const isCancelled = ev.cancelled;
            const isRegistered = ev.isRegistered && !isCancelled;

            return (
              <Box
                key={ev._id}
                style={{
                  background: isCancelled ? 'rgba(255,255,255,0.03)' : CARD_BG,
                  border: isCancelled
                    ? '0.5px solid rgba(255,255,255,0.06)'
                    : isRegistered
                    ? '0.5px solid rgba(34,197,94,0.3)'
                    : `0.5px solid ${BORDER}`,
                  borderRadius: 16,
                  padding: '18px 20px',
                  opacity: isCancelled ? 0.75 : 1,
                  transition: 'border-color 0.15s',
                }}
              >
                <Flex justify="between" align="start" gap="4">

                  {/* Left: event info */}
                  <Flex direction="column" gap="2" style={{ flex: 1, minWidth: 0 }}>

                    {/* Name + badges */}
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text
                        size="3"
                        weight="bold"
                        style={{
                          color: isCancelled ? TEXT_DIM : '#fff',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                        }}
                      >
                        {ev.name}
                      </Text>
                      {isCancelled && (
                        <Badge size="1" color="red" variant="soft">Cancelled</Badge>
                      )}
                      {ev.accessLevel === 'dupr_plus' && !isCancelled && (
                        <Badge size="1" color="amber" variant="soft">DUPR+</Badge>
                      )}
                      {isRegistered && (
                        <Badge size="1" style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '0.5px solid rgba(34,197,94,0.25)' }}>
                          Registered
                        </Badge>
                      )}
                    </Flex>

                    {/* Club name */}
                    <Text size="2" style={{ color: TEXT_MUTED }}>{ev.club.name}</Text>

                    {/* Date */}
                    <Flex align="center" gap="1">
                      <CalendarIcon width="13" height="13" color={TEXT_MUTED} />
                      <Text size="2" style={{ color: TEXT_DIM }}>{formatEventDate(ev.eventDate)}</Text>
                    </Flex>

                    {/* Location */}
                    {ev.location && (
                      <Flex align="center" gap="1">
                        <MapPin size={13} color={TEXT_MUTED} />
                        <Text size="2" style={{ color: TEXT_DIM }}>{ev.location}</Text>
                      </Flex>
                    )}

                    {/* Cancelled message */}
                    {isCancelled && (
                      <Text size="2" style={{ color: TEXT_MUTED, fontStyle: 'italic' }}>
                        This event has been cancelled. Contact the organiser if you have questions.
                      </Text>
                    )}

                    {/* Description (non-cancelled only) */}
                    {!isCancelled && ev.description && (
                      <Text
                        size="2"
                        style={{
                          color: TEXT_DIM,
                          marginTop: 2,
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
                      <Text size="1" style={{ color: '#f87171' }}>{cardError}</Text>
                    )}
                  </Flex>

                  {/* Right: action */}
                  <Flex direction="column" align="end" gap="4">

                    {ev.clubOwnerEmail && (
                      <Button
                        size="2"
                        radius="full"
                        variant="ghost"
                        color="gray"
                        onClick={() =>
                          (window.location.href = `mailto:${ev.clubOwnerEmail}?subject=Re: ${encodeURIComponent(ev.name)}`)
                        }
                        style={{ cursor: 'pointer', color: TEXT_DIM }}
                      >
                        <EnvelopeClosedIcon />
                        Contact organiser
                      </Button>
                    )}

                    {buttonState === 'registered' && (
                      <Flex align="center" gap="1">
                        <CheckCircledIcon color="#4ade80" width="16" height="16" />
                        <Text size="2" weight="medium" style={{ color: '#4ade80' }}>
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
                          backgroundColor: LIME,
                          color: '#0a0a0a',
                          fontWeight: 'bold',
                          cursor: isRegistering ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isRegistering ? <Spinner size="1" /> : 'Register'}
                      </Button>
                    )}

                    {buttonState === 'needs-dupr' && (
                      <Button
                        size="2"
                        radius="full"
                        onClick={onInitiateDuprLogin}
                        style={{
                          backgroundColor: LIME,
                          color: '#0a0a0a',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        Connect DUPR to Register
                      </Button>
                    )}

                    {buttonState === 'needs-plus' && (
                      <Flex direction="column" align="end" gap="1">
                        <Button
                          size="2"
                          radius="full"
                          disabled
                          style={{ cursor: 'not-allowed', opacity: 0.5 }}
                        >
                          <Lock size={13} />
                          DUPR+ Required
                        </Button>
                        <Text
                          size="1"
                          style={{
                            color: '#fbbf24',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() => window.open(DUPR_PLUS_UPGRADE_URL, '_blank')}
                        >
                          Upgrade to DUPR+ to register
                        </Text>
                      </Flex>
                    )}

                    {!isCancelled && (
                      <Text size="1" style={{ color: TEXT_MUTED }}>
                        {ev.registrationCount} registered
                      </Text>
                    )}
                  </Flex>
                </Flex>
              </Box>
            );
          })}

          {page < totalPages && (
            <Flex justify="center" pt="2">
              <Button
                variant="soft"
                color="gray"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ color: TEXT_DIM }}
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