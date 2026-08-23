'use client';

// Destination: app/(ADMIN)/admin/gg/age-review/page.tsx
//
// Shell (header + AdminSidebar + gating) matches the identity-issues page
// built earlier this session, for consistency across the admin surface.

import { useEffect, useState, useCallback } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  Box, Flex, Heading, Text, Card, Badge, Button, Spinner, Callout, Dialog,
} from '@radix-ui/themes';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { AdminSidebar } from "../../components/AdminSidebar";

type FlaggedAccount = {
  _id: string;
  name?: string;
  email?: string;
  dupr?: { id?: string; rating?: number };
  pendingAgeReviewReason?: 'confirmed_under_13' | 'unknown';
  pendingAgeReviewAt?: string;
  createdAt?: string;
  rewardCodeCount: number;
};

const REASON_LABELS: Record<string, { label: string; color: 'red' | 'amber' }> = {
  confirmed_under_13: { label: 'DUPR confirmed under 13', color: 'red' },
  unknown: { label: 'No birth year returned', color: 'amber' },
};

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AgeReviewPage() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();

  const [accounts, setAccounts] = useState<FlaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clearingId, setClearingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FlaggedAccount | null>(null);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/age-review', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load flagged accounts');
      setAccounts(data.accounts || []);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => {
    if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/gg/age-review');
  }, [auth0IsLoading, user, router]);

  const handleClear = async (account: FlaggedAccount) => {
    setClearingId(account._id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/age-review/${account._id}/clear`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear flag');
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
    } catch (e: any) {
      setActionError(e.message || 'Failed to clear flag.');
    } finally {
      setClearingId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/age-review/${removeTarget._id}/remove`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove account');
      setAccounts((prev) => prev.filter((a) => a._id !== removeTarget._id));
      setRemoveTarget(null);
    } catch (e: any) {
      setActionError(e.message || 'Failed to remove account.');
    } finally {
      setRemoving(false);
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
          <Box mb="6">
            <Heading>Age Review</Heading>
            <Text size="2" color="gray">
              Accounts whose DUPR-connected age couldn't be confirmed as 13+. Rewards are
              blocked while flagged — login and general use are not affected.
            </Text>
          </Box>

          {actionError && (
            <Callout.Root color="red" mb="4">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{actionError}</Callout.Text>
            </Callout.Root>
          )}

          {loading ? (
            <Flex justify="center" mt="9"><Spinner size="3" /></Flex>
          ) : error ? (
            <Callout.Root color="red">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : accounts.length === 0 ? (
            <Callout.Root color="gray">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>No accounts currently flagged for review.</Callout.Text>
            </Callout.Root>
          ) : (
            <Flex direction="column" gap="3">
              {accounts.map((account) => {
                const reasonInfo = account.pendingAgeReviewReason
                  ? REASON_LABELS[account.pendingAgeReviewReason]
                  : null;
                const hasRewards = account.rewardCodeCount > 0;

                return (
                  <Card
                    key={account._id}
                    style={{ borderLeft: '3px solid var(--amber-9)' }}
                  >
                    <Flex justify="between" align="start" gap="4">
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" gap="2" mb="1" wrap="wrap">
                          {reasonInfo && (
                            <Badge color={reasonInfo.color} variant="soft">{reasonInfo.label}</Badge>
                          )}
                          <Text size="1" color="gray">
                            Flagged {formatDate(account.pendingAgeReviewAt)}
                          </Text>
                          {hasRewards && (
                            <Badge color="red" variant="solid">
                              {account.rewardCodeCount} reward code{account.rewardCodeCount !== 1 ? 's' : ''} — review before removing
                            </Badge>
                          )}
                        </Flex>

                        <Text as="div" weight="bold" size="3">{account.name || '(no name)'}</Text>
                        <Text as="div" size="2" color="gray">
                          {account.email || 'no email'} {account.dupr?.id ? `· DUPR ${account.dupr.id}` : ''}
                          {account.dupr?.rating ? ` (${account.dupr.rating.toFixed(2)})` : ''}
                        </Text>
                        <Text as="div" size="1" color="gray" mt="1">
                          Account created {formatDate(account.createdAt)}
                        </Text>
                      </Box>

                      <Flex gap="2" style={{ flexShrink: 0 }}>
                        <Button
                          size="2"
                          variant="soft"
                          color="gray"
                          onClick={() => handleClear(account)}
                          loading={clearingId === account._id}
                        >
                          Clear flag (13+)
                        </Button>
                        <Button
                          size="2"
                          variant="solid"
                          color="red"
                          onClick={() => setRemoveTarget(account)}
                        >
                          Confirm removal
                        </Button>
                      </Flex>
                    </Flex>
                  </Card>
                );
              })}
            </Flex>
          )}
        </Flex>
      </Flex>

      <Dialog.Root open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Permanently remove this account?</Dialog.Title>
          <Flex direction="column" gap="3">
            <Text size="2">
              This deletes <Text weight="bold">{removeTarget?.name || 'this account'}</Text> entirely —
              the account, any reward codes issued to it, and its record in every match it appears
              in. Match scores and raw DUPR IDs are unaffected. <Text weight="bold">This cannot be undone.</Text>
            </Text>
            {removeTarget && removeTarget.rewardCodeCount > 0 && (
              <Callout.Root color="red" size="1">
                <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                <Callout.Text>
                  This account has {removeTarget.rewardCodeCount} reward code(s) associated with it —
                  unexpected, since rewards should be blocked while flagged. Worth investigating before
                  removing, not just clicking through.
                </Callout.Text>
              </Callout.Root>
            )}
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={removing}>Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={handleConfirmRemove} loading={removing}>
              Permanently remove
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}