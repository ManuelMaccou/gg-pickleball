'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, Flex, Spinner, Text, Box, Heading,
  Callout, Dialog,
} from '@radix-ui/themes';
import { PlusIcon, CheckCircledIcon, ReloadIcon } from '@radix-ui/react-icons';
import { ArrowRight, Building2, AlertCircle } from 'lucide-react';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { DuprConnectModal } from '@/app/components/DuprConnectModal';
import { FrontendUser } from '@/app/types/frontendTypes';

interface ConnectedClub {
  _id: string;
  name: string;
  duprClubId?: string;
}

interface DuprClub {
  clubId: number;
  clubName: string;
  role: string;
  alreadyConnected: boolean;
}

export default function ClubEntryPage() {
  const router = useRouter();
  const { user, setUser } = useUserContext();
  const { isLoading: auth0IsLoading } = useAuth0User();

  const [connectedClubs, setConnectedClubs] = useState<ConnectedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [duprConnectOpen, setDuprConnectOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [duprClubs, setDuprClubs] = useState<DuprClub[]>([]);
  const [fetchingDupr, setFetchingDupr] = useState(false);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [noClubsFound, setNoClubsFound] = useState(false);

  const isDuprConnected = !!user?.duprId;

  // ── Auth redirect — wait for auth0 to resolve before acting ──────────────
  useEffect(() => {
    if (auth0IsLoading) return;
    if (!user) {
      router.replace('/auth/login?returnTo=/admin/club');
    }
  }, [auth0IsLoading, user, router]);

  // ── Load clubs ─────────────────────────────────────────────────────────────
  const loadClubs = async () => {
    if (!user?.id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/club?adminId=${user.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load clubs');
      setConnectedClubs(data.clubs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth0IsLoading && user) loadClubs();
  }, [auth0IsLoading, user]);

  // ── Open connect dialog ────────────────────────────────────────────────────
  const handleOpenConnect = async () => {
    if (!isDuprConnected) { setDuprConnectOpen(true); return; }

    setConnectOpen(true);
    setConnectError(null);
    setNoClubsFound(false);
    setFetchingDupr(true);
    setDuprClubs([]);

    try {
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-dupr-clubs' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch DUPR clubs');
      const clubs = data.clubs ?? [];
      setDuprClubs(clubs);
      if (clubs.length === 0) setNoClubsFound(true);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Failed to fetch clubs from DUPR');
    } finally {
      setFetchingDupr(false);
    }
  };

  // ── Connect a club ─────────────────────────────────────────────────────────
  const handleConnect = async (club: DuprClub) => {
    setConnectingId(club.clubId);
    setConnectError(null);
    try {
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          duprClubId: club.clubId,
          clubName: club.clubName,
          duprRole: club.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect club');
      setConnectedClubs((prev) => [
        ...prev,
        { _id: data.club._id, name: data.club.name, duprClubId: data.club.duprClubId },
      ]);
      setDuprClubs((prev) =>
        prev.map((c) => (c.clubId === club.clubId ? { ...c, alreadyConnected: true } : c))
      );
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Failed to connect club');
    } finally {
      setConnectingId(null);
    }
  };

  // ── DUPR connected callback ────────────────────────────────────────────────
  const handleDuprConnected = (updatedUser: FrontendUser) => {
    if (user) setUser({ ...user, duprId: updatedUser.dupr?.id });
    loadClubs();
  };

  // ── Handle connect dialog close — reset all state ─────────────────────────
  const handleConnectDialogChange = (open: boolean) => {
    if (!open) {
      setConnectError(null);
      setNoClubsFound(false);
      setDuprClubs([]);
    }
    setConnectOpen(open);
  };

  // ── Loading / auth pending ─────────────────────────────────────────────────
  if (auth0IsLoading || (loading && !error)) {
    return (
      <Flex
        justify="center"
        align="center"
        height="100vh"
        direction="column"
        gap="3"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        <Spinner size="3" style={{color: '#a3e635'}} />
        <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your clubs…</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <Flex direction={'column'} align={'center'} justify={'center'} height={'50px'}
        style={{backgroundColor: "#5b1010"}}>
          <Text style={{color: 'white'}}>This feature is in beta. Please contact us with any feature requests.</Text>
      </Flex>

      {/* Header */}
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
        }}
      >
        <Text weight="bold" size="3" style={{ color: '#fff' }}>My Clubs</Text>
        <Button
          onClick={handleOpenConnect}
          radius="full"
          style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}
        >
          <PlusIcon />
          {isDuprConnected ? 'Connect Club' : 'Connect DUPR Account'}
        </Button>
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="6" style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Fetch error with retry */}
          {error && (
            <Callout.Root color="red">
              <Flex justify="between" align="center" gap="4" style={{ flex: 1 }}>
                <Callout.Text>{error}</Callout.Text>
                <Button
                  size="1"
                  variant="soft"
                  color="red"
                  onClick={loadClubs}
                  style={{ flexShrink: 0, cursor: 'pointer' }}
                >
                  <ReloadIcon /> Try again
                </Button>
              </Flex>
            </Callout.Root>
          )}

          {/* DUPR not connected callout */}
          {!isDuprConnected && (
            <Box style={{
              background: 'rgba(163,230,53,0.06)',
              border: '0.5px solid rgba(163,230,53,0.2)',
              borderRadius: 12,
              padding: '14px 18px',
            }}>
              <Text size="2" style={{ color: '#a3e635', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                DUPR account required
              </Text>
              <Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Connect your DUPR account to get started. This is required to manage clubs and upload matches.
              </Text>
            </Box>
          )}

          {/* Empty state */}
          {!error && connectedClubs.length === 0 && (
            <Box style={{
              background: '#111',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '48px 32px',
              textAlign: 'center',
            }}>
              <Flex
                align="center" justify="center" mb="4"
                style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(163,230,53,0.1)',
                  border: '0.5px solid rgba(163,230,53,0.2)',
                  margin: '0 auto 16px',
                }}
              >
                <Building2 size={22} color="#a3e635" />
              </Flex>
              <Heading size="5" mb="2" style={{ color: '#fff' }}>No clubs connected</Heading>
              <Text size="2" mb="5" style={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                {isDuprConnected
                  ? 'Connect a club from your DUPR account to start uploading matches.'
                  : 'Connect your DUPR account first, then link your clubs.'}
              </Text>
              <Button
                onClick={handleOpenConnect}
                radius="full"
                style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}
              >
                <PlusIcon />
                {isDuprConnected ? 'Connect Club' : 'Connect DUPR Account'}
              </Button>
            </Box>
          )}

          {/* Club list */}
          {connectedClubs.length > 0 && (
            <Flex direction="column" gap="3">
              <Text
                size="1"
                weight="bold"
                style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {connectedClubs.length} {connectedClubs.length === 1 ? 'club' : 'clubs'} connected
              </Text>
              {connectedClubs.map((club) => (
                <Box
                  key={club._id}
                  style={{
                    background: '#111',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onClick={() => router.push(`/admin/club/${club._id}/events`)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(163,230,53,0.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="3">
                      <Flex
                        align="center" justify="center"
                        style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: 'rgba(163,230,53,0.1)',
                          border: '0.5px solid rgba(163,230,53,0.2)',
                        }}
                      >
                        <Building2 size={18} color="#a3e635" />
                      </Flex>
                      <Box>
                        <Text size="3" weight="bold" style={{ color: '#fff', display: 'block' }}>
                          {club.name}
                        </Text>
                        {club.duprClubId && (
                          <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                            DUPR ID: {club.duprClubId}
                          </Text>
                        )}
                      </Box>
                    </Flex>
                    <Flex align="center" gap="2">
                      <Text size="2" style={{ color: 'rgba(255,255,255)' }}>Manage events</Text>
                      <ArrowRight size={16} color="rgba(255,255,255,0.8)" />
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
        </Flex>
      </Box>

      <DuprConnectModal
        open={duprConnectOpen}
        onOpenChange={setDuprConnectOpen}
        onConnected={handleDuprConnected}
      />

      {/* Connect Club Dialog */}
      <Dialog.Root open={connectOpen} onOpenChange={handleConnectDialogChange}>
        <Dialog.Content
          style={{ maxWidth: 560, backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}
        >
          <Dialog.Title style={{ color: '#fff' }}>Connect a DUPR Club</Dialog.Title>
          <Dialog.Description size="2" mb="4" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Showing clubs where you are an Organizer or Director on DUPR.
          </Dialog.Description>

          {/* Error from API */}
          {connectError && (
            <Callout.Root color="red" mb="3">
              <Callout.Text>{connectError}</Callout.Text>
              {connectError.includes('reconnect') && (
                <Button
                  size="1" variant="soft" mt="2"
                  onClick={() => { setConnectOpen(false); setDuprConnectOpen(true); }}
                >
                  Reconnect DUPR Account
                </Button>
              )}
            </Callout.Root>
          )}

          {/* No clubs found — neutral empty state, not an error */}
          {noClubsFound && !connectError && (
            <Flex
              direction="column" align="center" gap="2" py="5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                marginBottom: 12,
              }}
            >
              <AlertCircle size={20} color="rgba(255,255,255,0.5)" />
              <Text size="2" align="center" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 320 }}>
                No eligible clubs found on your DUPR account. You need an Organizer or Director role to connect a club.
              </Text>
            </Flex>
          )}

          {noClubsFound && !connectError && (
            <Flex align={'center'} justify={'center'}>
             <Dialog.Close>
                <Button mt={'5'} mb={'-5'} variant='soft'>Close</Button>
              </Dialog.Close>
              </Flex>
          )}

          {fetchingDupr ? (
            <Flex justify="center" p="6"><Spinner size="2" style={{color: '#a3e635'}}/></Flex>
          ) : (
            <Flex direction="column" gap="2">
              {duprClubs.map((club) => (
                <Box
                  key={club.clubId}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <Flex justify="between" align="center">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium" style={{ color: '#fff' }}>{club.clubName}</Text>
                      <Flex gap="4" align={'center'}>
                        <Text size="1" style={{color: 'white'}}>ID: {club.clubId}</Text>
                        <Badge size="1" color="blue">{club.role}</Badge>
                      </Flex>
                    </Flex>
                    {club.alreadyConnected ? (
                      <Flex align="center" gap="1">
                        <CheckCircledIcon color="var(--green-9)" />
                        <Text size="1" color="green">Connected</Text>
                      </Flex>
                    ) : (
                      <Button
                        size="1" radius="full"
                        onClick={() => handleConnect(club)}
                        disabled={connectingId === club.clubId}
                        style={{ backgroundColor: '#a3e635', color: '#0a0a0a', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {connectingId === club.clubId ? 'Connecting…' : 'Connect'}
                      </Button>
                    )}
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}

          <Flex justify="center" mt="5">
            <Button variant="ghost" onClick={() => handleConnectDialogChange(false)}>
              Close
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}