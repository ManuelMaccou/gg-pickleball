'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flex, Spinner, Text, Card, Button, Box, Callout, Heading,
  Badge, Table, Dialog,
} from '@radix-ui/themes';
import { PlusIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
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

  const [connectedClubs, setConnectedClubs] = useState<ConnectedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DUPR connect modal
  const [duprConnectOpen, setDuprConnectOpen] = useState(false);

  // Connect club dialog state
  const [connectOpen, setConnectOpen] = useState(false);
  const [duprClubs, setDuprClubs] = useState<DuprClub[]>([]);
  const [fetchingDupr, setFetchingDupr] = useState(false);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const isDuprConnected = !!user?.duprId;

  // Load connected clubs
  const loadClubs = async () => {
    if (!user) {
      router.replace('/auth/login?returnTo=/admin/club');
      return;
    }
    if (!user?.id) return;
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

  useEffect(() => { loadClubs(); }, [user]);

  // Fetch available DUPR clubs when connect dialog opens
  const handleOpenConnect = async () => {
    if (!isDuprConnected) {
      // User needs to connect DUPR first
      setDuprConnectOpen(true);
      return;
    }

    setConnectOpen(true);
    setConnectError(null);
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
      setDuprClubs(data.clubs ?? []);
      if ((data.clubs ?? []).length === 0) {
        setConnectError('No eligible clubs found on your DUPR account. You need an ORGANIZER or DIRECTOR role.');
      }
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Failed to fetch clubs from DUPR');
    } finally {
      setFetchingDupr(false);
    }
  };

  // Connect a specific DUPR club
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

const handleDuprConnected = (updatedUser: FrontendUser) => {
  if (user) setUser({ ...user, duprId: updatedUser.dupr?.id });
  loadClubs();
};

  if (loading) {
    return (
      <Flex justify="center" align="center" height="100vh" direction="column" gap="3">
        <Spinner size="3" />
        <Text size="2" color="gray">Loading your clubs...</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <Flex justify="between" align="center" height="64px" px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}>
        <Text weight="bold" size="3">My Clubs</Text>
        <Button onClick={handleOpenConnect}>
          <PlusIcon /> {isDuprConnected ? 'Connect Club' : 'Connect DUPR Account'}
        </Button>
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="6" style={{ maxWidth: 800, margin: '0 auto' }}>

          {error && (
            <Callout.Root color="red">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          {!isDuprConnected && (
            <Callout.Root color="blue" mb="2">
              <Callout.Text>
                Connect your DUPR account to get started. This is required to manage clubs and upload matches.
              </Callout.Text>
            </Callout.Root>
          )}

          {connectedClubs.length === 0 ? (
            <Card size="3">
              <Flex direction="column" align="center" gap="3" py="6">
                <Heading size="4">No clubs connected</Heading>
                <Text size="2" color="gray" align="center">
                  {isDuprConnected
                    ? 'Connect a club from your DUPR account to start uploading matches.'
                    : 'Connect your DUPR account first, then link your clubs.'}
                </Text>
                <Button onClick={handleOpenConnect} mt="2">
                  <PlusIcon /> {isDuprConnected ? 'Connect Club' : 'Connect DUPR Account'}
                </Button>
              </Flex>
            </Card>
          ) : (
            <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Club Name</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>DUPR Club ID</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {connectedClubs.map((club) => (
                    <Table.Row key={club._id}>
                      <Table.Cell>
                        <Text size="2" weight="medium">{club.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="gray" variant="surface">{club.duprClubId ?? '—'}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="soft"
                          size="1"
                          onClick={() => router.push(`/admin/club/${club._id}/events`)}
                        >
                          Manage
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
          )}
        </Flex>
      </Box>

      {/* DUPR Account Connect Modal */}
      <DuprConnectModal
        open={duprConnectOpen}
        onOpenChange={setDuprConnectOpen}
        onConnected={handleDuprConnected}
      />

      {/* Connect Club Dialog */}
      <Dialog.Root open={connectOpen} onOpenChange={setConnectOpen}>
        <Dialog.Content style={{ maxWidth: 560 }}>
          <Dialog.Title>Connect a DUPR Club</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Showing clubs where you are an Organizer or Director on DUPR.
          </Dialog.Description>

          {connectError && (
            <Callout.Root color="red" mb="3">
              <Callout.Text>{connectError}</Callout.Text>
              {connectError.includes('reconnect') && (
                <Button size="1" variant="soft" mt="2"
                  onClick={() => { setConnectOpen(false); setDuprConnectOpen(true); }}>
                  Reconnect DUPR Account
                </Button>
              )}
            </Callout.Root>
          )}

          {fetchingDupr ? (
            <Flex justify="center" p="6"><Spinner size="2" /></Flex>
          ) : (
            <Flex direction="column" gap="2">
              {duprClubs.map((club) => (
                <Card key={club.clubId} size="1">
                  <Flex justify="between" align="center">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">{club.clubName}</Text>
                      <Flex gap="2">
                        <Badge size="1" color="gray">ID: {club.clubId}</Badge>
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
                        size="1"
                        onClick={() => handleConnect(club)}
                        disabled={connectingId === club.clubId}
                      >
                        {connectingId === club.clubId ? 'Connecting…' : 'Connect'}
                      </Button>
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}

          <Flex justify="end" mt="5">
            <Button variant="soft" color="gray" onClick={() => setConnectOpen(false)}>Close</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}