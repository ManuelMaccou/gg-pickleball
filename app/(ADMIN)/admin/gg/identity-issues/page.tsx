'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  Box, Flex, Heading, Text, Card, Badge, Button, Select, Spinner, Callout,
} from '@radix-ui/themes';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { AdminSidebar } from "../../components/AdminSidebar";
import { IdentityIssueResolveDialog } from './IdentityIssueResolveDialog';

const CONFLICT_LABELS: Record<string, string> = {
  email_matches_dupr_conflict: "Email matches, DUPR ID doesn't",
  dupr_matches_email_conflict: "DUPR ID matches, email doesn't",
  cross_match_conflict: 'Cross-match — two different accounts',
};

type StatusFilter = 'open' | 'resolved' | 'all';

export default function IdentityIssuesPage() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [activeIssue, setActiveIssue] = useState<any | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'all'
        ? '/api/admin/player-identity-issues'
        : `/api/admin/player-identity-issues?status=${statusFilter}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load issues');
      setIssues(data.issues || []);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => {
    if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/gg/identity-issues');
  }, [auth0IsLoading, user, router]);

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
            <Box>
              <Heading>Player Identity Issues</Heading>
              <Text size="2" color="gray">
                Rows from Players uploads whose email and DUPR ID didn't reconcile to a single account.
              </Text>
            </Box>
            <Select.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="open">Open</Select.Item>
                <Select.Item value="resolved">Resolved</Select.Item>
                <Select.Item value="all">All</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {loading ? (
            <Flex justify="center" mt="9"><Spinner size="3" /></Flex>
          ) : error ? (
            <Callout.Root color="red">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : issues.length === 0 ? (
            <Callout.Root color="gray">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>
                {statusFilter === 'open' ? 'No open issues.' : 'No issues found.'}
              </Callout.Text>
            </Callout.Root>
          ) : (
            <Flex direction="column" gap="3">
              {issues.map((issue) => (
                <Card
                  key={issue._id}
                  style={{
                    borderLeft: issue.status === 'open'
                      ? '3px solid var(--amber-9)'
                      : '3px solid var(--gray-6)',
                  }}
                >
                  <Flex justify="between" align="start" gap="4">
                    <Box style={{ flex: 1 }}>
                      <Flex align="center" gap="2" mb="1" wrap="wrap">
                        <Badge color={issue.status === 'open' ? 'amber' : 'gray'} variant="soft">
                          {issue.status === 'open' ? 'Open' : 'Resolved'}
                        </Badge>
                        <Badge color="gray" variant="outline">
                          {CONFLICT_LABELS[issue.conflictType] ?? issue.conflictType}
                        </Badge>
                        {issue.attempts?.length > 0 && (
                          <Text size="1" color="gray">
                            {issue.attempts.length} attempt{issue.attempts.length !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </Flex>

                      <Text as="div" weight="bold" size="3">{issue.submittedName || '(no name)'}</Text>
                      <Text as="div" size="2" color="gray">
                        Submitted: {issue.submittedEmail} / DUPR {issue.submittedDuprId}
                      </Text>

                      <Flex gap="2" mt="2" wrap="wrap">
                        {issue.implicatedUserIds?.map((u: any) => (
                          <Badge key={u._id} color={u.identityUnresolved ? 'red' : 'gray'} variant="soft">
                            {u.name} — {u.email || 'no email'} {u.dupr?.id ? `(DUPR ${u.dupr.id})` : '(no DUPR)'}
                          </Badge>
                        ))}
                      </Flex>

                      {issue.notes && (
                        <Text as="div" size="1" color="gray" mt="2" style={{ fontStyle: 'italic' }}>
                          Note: {issue.notes}
                        </Text>
                      )}

                      {issue.status === 'resolved' && (
                        <Text as="div" size="1" color="gray" mt="2">
                          Resolved {issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : ''}
                          {issue.resolvedBy?.name ? ` by ${issue.resolvedBy.name}` : ''} —{' '}
                          {issue.resolvedEmail} / {issue.resolvedDuprId}
                        </Text>
                      )}
                    </Box>

                    {issue.status === 'open' && (
                      <Button size="2" onClick={() => setActiveIssue(issue)} style={{ flexShrink: 0 }}>
                        Resolve
                      </Button>
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}

          {activeIssue && (
            <IdentityIssueResolveDialog
              issue={activeIssue}
              open={!!activeIssue}
              onOpenChange={(open) => { if (!open) setActiveIssue(null); }}
              onResolved={() => { setActiveIssue(null); fetchIssues(); }}
            />
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}