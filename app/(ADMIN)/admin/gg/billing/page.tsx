'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useRouter } from 'next/navigation';
import {
  Avatar, Badge, Box, Button, Callout, Card, Dialog, Flex,
  Heading, Select, Spinner, Table, Text, TextField,
} from '@radix-ui/themes';
import { InfoCircledIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { DateTime } from 'luxon';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { AdminSidebar } from '../../components/AdminSidebar';

// ── Types ─────────────────────────────────────────────────────────────────────
type CommissionStatus = 'pending' | 'held' | 'charged' | 'waived' | 'review';

interface CommissionRow {
  _id: string;
  clientName: string;
  shopifyOrderId: string;
  discountCode: string;
  orderTotal: number;
  refundedAmount: number;
  commissionAmount: number;
  commissionRate: number;
  status: CommissionStatus;
  chargeAfter: string;
  orderCreatedAt: string;
  stripeInvoiceId?: string;
  reviewNote?: string;
}

interface Summary {
  totalPending: number;
  totalHeld: number;
  totalCharged: number;
  totalWaived: number;
  countPending: number;
  countHeld: number;
  countCharged: number;
  countWaived: number;
  countReview: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (s: string) =>
  s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const STATUS_COLOR: Record<CommissionStatus, 'gray' | 'amber' | 'green' | 'red' | 'orange'> = {
  pending: 'gray',
  held: 'amber',
  charged: 'green',
  waived: 'red',
  review: 'orange',
};

const WAIVABLE_STATUSES: CommissionStatus[] = ['pending', 'held', 'review'];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GGAdminBillingPage() {
  const { user } = useUserContext();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const router = useRouter();

  const [records, setRecords] = useState<CommissionRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Waive dialog state
  const [waiveTarget, setWaiveTarget] = useState<CommissionRow | null>(null);
  const [waiveNote, setWaiveNote] = useState('');
  const [waiving, setWaiving] = useState(false);
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/commissions?status=${statusFilter}&page=${page}&limit=50`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load commissions');
      setRecords(data.records);
      setSummary(data.summary);
      setTotalPages(data.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading commissions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push('/auth/login?returnTo=/admin/gg/billing');
    }
  }, [auth0IsLoading, user, router]);

  useEffect(() => {
    if (user?.superAdmin) fetchRecords();
  }, [user, fetchRecords]);

  const handleWaive = async () => {
    if (!waiveTarget) return;
    setWaiving(true);
    setWaiveError(null);
    try {
      const res = await fetch('/api/admin/commissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commissionId: waiveTarget._id,
          action: 'waive',
          note: waiveNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Waive failed');
      setWaiveTarget(null);
      setWaiveNote('');
      fetchRecords();
    } catch (e) {
      setWaiveError(e instanceof Error ? e.message : 'Failed to waive commission');
    } finally {
      setWaiving(false);
    }
  };

  if (user && !user.superAdmin) {
    return (
      <Flex align="center" justify="center" height="100vh">
        <Text>You do not have access to this page.</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      {/* Header */}
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
            {user?.name ? `Welcome ${String(user.name).split('@')[0]}` : ''}
          </Text>
        )}
      </Flex>

      <Flex direction="row" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <AdminSidebar adminPermission="admin" />

        {/* Main content */}
        <Flex direction="column" py="4" px={{ initial: '2', md: '6' }} width="100%" style={{ overflowY: 'auto' }}>
          <Flex justify="between" align="center" mb="6">
            <Heading>Commission Billing</Heading>
          </Flex>

          {error && (
            <Callout.Root color="red" mb="4">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          {/* Summary cards */}
          {summary && (
            <Flex gap="3" mb="6" wrap="wrap">
              {[
                { label: 'Pending', count: summary.countPending, amount: summary.totalPending, color: 'gray' },
                { label: 'Held', count: summary.countHeld, amount: summary.totalHeld, color: 'amber' },
                { label: 'Charged', count: summary.countCharged, amount: summary.totalCharged, color: 'green' },
                { label: 'Waived', count: summary.countWaived, amount: summary.totalWaived, color: 'red' },
                { label: 'Review', count: summary.countReview, amount: 0, color: 'orange' },
              ].map(({ label, count, amount, color }) => (
                <Card key={label} size="2" style={{ minWidth: 140 }}>
                  <Flex direction="column" gap="1">
                    <Badge color={color as any} variant="soft" size="1">{label}</Badge>
                    <Text size="5" weight="bold">{count}</Text>
                    {amount > 0 && (
                      <Text size="1" color="gray">{formatCurrency(amount)}</Text>
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}

          {/* Filter + table */}
          <Flex justify="between" align="center" mb="3">
            <Select.Root
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="all">All statuses</Select.Item>
                <Select.Item value="pending">Pending</Select.Item>
                <Select.Item value="held">Held</Select.Item>
                <Select.Item value="charged">Charged</Select.Item>
                <Select.Item value="waived">Waived</Select.Item>
                <Select.Item value="review">Review</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Client</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Order</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Sale</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Commission</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Charge After</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Flex justify="center" p="6"><Spinner size="2" /></Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : records.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Text color="gray" align="center" my="4">No commission records found.</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  records.map((r) => (
                    <Table.Row key={r._id}>
                      <Table.Cell>
                        <Text size="2" weight="medium">{r.clientName}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: 'monospace' }}>{r.shopifyOrderId}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: 'monospace' }}>{r.discountCode}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column">
                          <Text size="2">{formatCurrency(r.orderTotal)}</Text>
                          {r.refundedAmount > 0 && (
                            <Text size="1" color="red">-{formatCurrency(r.refundedAmount)} refunded</Text>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="medium">{formatCurrency(r.commissionAmount)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">{formatDate(r.chargeAfter)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Badge color={STATUS_COLOR[r.status]} radius="full" size="1">
                            {r.status}
                          </Badge>
                          {r.stripeInvoiceId && (
                            <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                              {r.stripeInvoiceId}
                            </Text>
                          )}
                          {r.reviewNote && (
                            <Text size="1" color="gray">{r.reviewNote}</Text>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        {WAIVABLE_STATUSES.includes(r.status) && (
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={() => { setWaiveTarget(r); setWaiveNote(''); setWaiveError(null); }}
                          >
                            Waive
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>

            {/* Pagination */}
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
      </Flex>

      {/* Waive dialog */}
      <Dialog.Root open={!!waiveTarget} onOpenChange={(open) => !open && setWaiveTarget(null)}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Waive Commission</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            This will permanently waive the{' '}
            <Text weight="bold">{waiveTarget ? formatCurrency(waiveTarget.commissionAmount) : ''}</Text>{' '}
            commission for order{' '}
            <Text style={{ fontFamily: 'monospace' }}>{waiveTarget?.shopifyOrderId}</Text>{' '}
            from <Text weight="bold">{waiveTarget?.clientName}</Text>. This cannot be undone.
          </Dialog.Description>

          {waiveError && (
            <Callout.Root color="red" mb="3" size="1">
              <Callout.Text>{waiveError}</Callout.Text>
            </Callout.Root>
          )}

          <Box mb="4">
            <Text size="2" weight="medium" mb="1">Reason (optional)</Text>
            <TextField.Root
              value={waiveNote}
              onChange={(e) => setWaiveNote(e.target.value)}
              placeholder="e.g. Client dispute, goodwill gesture..."
            />
          </Box>

          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={handleWaive} disabled={waiving}>
              {waiving ? <Spinner size="1" /> : null}
              {waiving ? 'Waiving…' : 'Confirm Waive'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}