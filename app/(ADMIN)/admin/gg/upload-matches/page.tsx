'use client';

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  Badge, Box, Button, Callout, Card, Flex, Heading, Select, Spinner, Text,
} from "@radix-ui/themes";
import {
  InfoCircledIcon, CheckCircledIcon,
} from "@radix-ui/react-icons";
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { AdminSidebar } from "../../components/AdminSidebar";
import PlayersUploadSection from "../../components/PlayersUploadSection";
import MatchesUploadSection from "../../components/MatchesUploadSection";

type ProgramSummary = {
  id: string;
  name: string;
  date: string;
  club: string;
};

type ProgramApplicationListItem = {
  applicationId: string;
  programName: string;
  club: string;
  programStartDate: string;
  programEndDate: string;
  submittedAt: string;
  submittedByName: string;
  submittedByTitle: string;
  submittedByEmail: string;
  submittedByPhone: string;
  program: ProgramSummary | null;
};

const formatDate = (isoDateStr: string): string => {
  const d = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function UploadMatchesPage() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();

  const [applications, setApplications] = useState<ProgramApplicationListItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('');
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      const r = await fetch('/api/admin/program-applications');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to fetch program applications');
      setApplications(d.applications);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { fetchApplications(); }, []);
  useEffect(() => {
    if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/gg/upload-matches');
  }, [auth0IsLoading, user, router]);

  const selectedApplication = applications.find(a => a.applicationId === selectedApplicationId) || null;

  const handleCreateProgram = async () => {
    if (!selectedApplication) return;
    setIsCreatingProgram(true);
    setCreateError(null);
    try {
      const r = await fetch('/api/admin/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programApplicationId: selectedApplication.applicationId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to create program');

      setApplications(prev => prev.map(a =>
        a.applicationId === selectedApplication.applicationId
          ? { ...a, program: d.program }
          : a
      ));
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsCreatingProgram(false);
    }
  };

  const userName = user?.name;
  if (isMobile === null) return null;

  if (user && !user.superAdmin) {
    return (
      <Flex direction="column" height="100vh">
        <Flex justify="between" align="center" px={{ initial: '3', md: '9' }} py="4">
          <Flex direction="column" position="relative" maxWidth="80px">
            <Image src={darkGgLogo} alt="GG Pickleball" priority height={540} width={960} />
          </Flex>
          {!auth0IsLoading && <Text size="3" weight="bold">{userName ? (auth0User ? `Welcome ${String(userName).split('@')[0]}` : `${String(userName).split('@')[0]} (guest)`) : ''}</Text>}
        </Flex>
        <Flex direction="column" align="center" justify="center" height="300px"><Text>You do not have access to this page</Text></Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      <Flex
        justify="between"
        align="center"
        px={{ initial: '3', md: '9' }}
        py="4"
        style={{ borderBottom: '1px solid var(--gray-4)', backgroundColor: 'white' }}
      >
        <Flex direction="column" position="relative" maxWidth="80px">
          <Image src={darkGgLogo} alt="GG Pickleball" priority height={540} width={960} />
        </Flex>
        {!auth0IsLoading && (
          <Text size="3" weight="bold">
            {userName ? `Welcome ${String(userName).split('@')[0]}` : ''}
          </Text>
        )}
      </Flex>

      <Flex direction="row" style={{ minHeight: 'calc(100vh - 64px)' }}>
        {!isMobile && <AdminSidebar adminPermission={user?.superAdmin ? 'admin' : 'associate'} />}

        <Flex direction="column" py="4" px={{ initial: '2', md: '6' }} width="100%" style={{ overflowY: 'auto' }}>
          <Flex justify="between" align="center" mb="6">
            <Heading>Upload Matches</Heading>
          </Flex>

          {/* Step 1: select a program application */}
          <Box mb="5">
            <Text as="div" size="2" weight="bold" mb="2">1. Select a program</Text>
            <Text as="div" size="2" color="gray" mb="3">
              Only approved applications are listed. Approve an application by flipping its
              status in the database — there's no review screen yet.
            </Text>

            {isFetching ? (
              <Flex align="center" gap="2"><Spinner size="2" /> <Text size="2" color="gray">Loading applications…</Text></Flex>
            ) : fetchError ? (
              <Callout.Root color="red">
                <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                <Callout.Text>{fetchError}</Callout.Text>
              </Callout.Root>
            ) : applications.length === 0 ? (
              <Text size="2" color="gray">No approved program applications yet.</Text>
            ) : (
              <Select.Root
                value={selectedApplicationId}
                onValueChange={(v) => { setSelectedApplicationId(v); setCreateError(null); }}
              >
                <Select.Trigger placeholder="Choose a program application…" style={{ minWidth: 340 }} />
                <Select.Content>
                  {applications.map(a => (
                    <Select.Item key={a.applicationId} value={a.applicationId}>
                      {a.programName} — {a.club} ({formatDate(a.programStartDate)}–{formatDate(a.programEndDate)})
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}
          </Box>

          {/* Step 2: review + create/continue */}
          {selectedApplication && (
            <Box mb="6">
              <Text as="div" size="2" weight="bold" mb="2">2. Review &amp; {selectedApplication.program ? 'continue' : 'create program'}</Text>
              <Card size="2" style={{ maxWidth: 520 }}>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="start">
                    <Box>
                      <Text as="div" weight="bold">{selectedApplication.programName}</Text>
                      <Text as="div" size="2" color="gray">{selectedApplication.club}</Text>
                    </Box>
                    {selectedApplication.program && (
                      <Badge color="green" variant="soft" size="1">
                        <CheckCircledIcon /> Program created
                      </Badge>
                    )}
                  </Flex>

                  <Box>
                    <Text as="div" size="2" color="gray">
                      {formatDate(selectedApplication.programStartDate)} – {formatDate(selectedApplication.programEndDate)}
                    </Text>
                  </Box>

                  <Box style={{ borderTop: '1px solid var(--gray-a4)', paddingTop: 10 }}>
                    <Text as="div" size="1" color="gray" mb="1">Submitted by</Text>
                    <Text as="div" size="2">{selectedApplication.submittedByName}, {selectedApplication.submittedByTitle}</Text>
                    <Text as="div" size="2" color="gray">{selectedApplication.submittedByEmail} · {selectedApplication.submittedByPhone}</Text>
                  </Box>

                  {createError && (
                    <Callout.Root color="red" size="1">
                      <Callout.Text>{createError}</Callout.Text>
                    </Callout.Root>
                  )}

                  {selectedApplication.program ? (
                    <Box style={{ borderTop: '1px solid var(--gray-a4)', paddingTop: 10 }}>
                      <Text as="div" size="2" color="gray">
                        Matches CSV upload happens after this — not built yet.
                      </Text>
                    </Box>
                  ) : (
                    <Button onClick={handleCreateProgram} loading={isCreatingProgram}>
                      Create Program
                    </Button>
                  )}
                </Flex>
              </Card>
            </Box>
          )}

          {/* Step 3: upload players */}
          {selectedApplication?.program && (
            <Box mb="6">
              <Text as="div" size="2" weight="bold" mb="2">3. Upload players</Text>
              <Text as="div" size="2" color="gray" mb="3">
                Creates an account for every eligible (13+) participant not already in the
                system. Do this before uploading matches — the matches CSV only looks players
                up by DUPR ID, it can't create accounts itself.
              </Text>
              <PlayersUploadSection programId={selectedApplication.program.id} />
            </Box>
          )}

          {/* Step 4: upload matches */}
          {selectedApplication?.program && (
            <Box mb="6">
              <Text as="div" size="2" weight="bold" mb="2">4. Upload matches</Text>
              <Text as="div" size="2" color="gray" mb="3">
                Run this after the players upload for this program. Each row is one game.
              </Text>
              <MatchesUploadSection programId={selectedApplication.program.id} />
            </Box>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}