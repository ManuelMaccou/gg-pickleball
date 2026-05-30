'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useRouter } from 'next/navigation';
import {
  Badge, Box, Button, Callout, Card, Checkbox, Dialog, Flex,
  Heading, Select, Spinner, Table, Text, TextArea,
} from '@radix-ui/themes';
import { InfoCircledIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { DateTime } from 'luxon';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { AdminSidebar } from '../../components/AdminSidebar';

// ── Types ─────────────────────────────────────────────────────────────────────

type ApplicationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

interface ApplicationRow {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  email: string;
  brandName?: string;
  website?: string;
  description?: string;
  shopifyConfirmed: boolean;
  status: ApplicationStatus;
  reviewNote?: string;
  reviewedAt?: string;
  clientId?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  countDraft: number;
  countPending: number;
  countApproved: number;
  countRejected: number;
}

const STATUS_COLOR: Record<ApplicationStatus, 'gray' | 'amber' | 'green' | 'red'> = {
  draft: 'gray',
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const formatDate = (s?: string) =>
  s ? DateTime.fromISO(s).toFormat('MMM d, yyyy') : '—';

export default function GGAdminBrandApplicationsPage() {
  const { user } = useUserContext();
  const { isLoading: auth0IsLoading } = useAuth0User();
  const router = useRouter();

  const [records, setRecords] = useState<ApplicationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail dialog
  const [detailTarget, setDetailTarget] = useState<ApplicationRow | null>(null);

  // Approve dialog
  const [approveTarget, setApproveTarget] = useState<ApplicationRow | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<ApplicationRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSendEmail, setRejectSendEmail] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: '50',
      });
      const res = await fetch(`/api/admin/brand-applications?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load applications');
      setRecords(data.applications);
      setSummary(data.summary);
      setTotalPages(data.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading applications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push('/auth/login?returnTo=/admin/gg/brand-applications');
    }
  }, [auth0IsLoading, user, router]);

  useEffect(() => {
    if (user?.superAdmin) fetchRecords();
  }, [user, fetchRecords]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/admin/brand-applications/${approveTarget._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Approval failed');
      setApproveTarget(null);
      fetchRecords();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/admin/brand-applications/${rejectTarget._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reviewNote: rejectNote.trim() || undefined,
          sendEmail: rejectSendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Rejection failed');
      setRejectTarget(null);
      setRejectNote('');
      setRejectSendEmail(true);
      fetchRecords();
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setRejecting(false);
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

        <Flex
          direction="column"
          py="4"
          px={{ initial: '2', md: '6' }}
          width="100%"
          style={{ overflowY: 'auto' }}
        >
          <Flex justify="between" align="center" mb="6">
            <Heading>Brand Applications</Heading>
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
                { label: 'Draft', count: summary.countDraft, color: 'gray' },
                { label: 'Pending', count: summary.countPending, color: 'amber' },
                { label: 'Approved', count: summary.countApproved, color: 'green' },
                { label: 'Rejected', count: summary.countRejected, color: 'red' },
              ].map(({ label, count, color }) => (
                <Card key={label} size="2" style={{ minWidth: 140 }}>
                  <Flex direction="column" gap="1">
                    <Badge color={color as any} variant="soft" size="1">{label}</Badge>
                    <Text size="5" weight="bold">{count}</Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}

          {/* Filter */}
          <Flex justify="between" align="center" mb="3">
            <Select.Root
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="all">All statuses</Select.Item>
                <Select.Item value="draft">Draft</Select.Item>
                <Select.Item value="pending">Pending</Select.Item>
                <Select.Item value="approved">Approved</Select.Item>
                <Select.Item value="rejected">Rejected</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Table */}
          <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Applicant</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Website</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Submitted</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row>
                    <Table.Cell colSpan={6}>
                      <Flex justify="center" p="6"><Spinner size="2" /></Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : records.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={6}>
                      <Text color="gray" align="center" my="4">No applications found.</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  records.map((r) => (
                    <Table.Row key={r._id}>
                      <Table.Cell>
                        <Text size="2" weight="medium">{r.brandName || <em>—</em>}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column">
                          <Text size="2">{r.userName}</Text>
                          <Text size="1" color="gray">{r.userEmail}</Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        {r.website ? (
                          <a
                            href={r.website.startsWith('http') ? r.website : `https://${r.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-11)', textDecoration: 'none' }}
                          >
                            <Flex align="center" gap="1">
                              <Text size="2">Visit</Text>
                              <ExternalLinkIcon />
                            </Flex>
                          </a>
                        ) : (
                          <Text size="2" color="gray">—</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" color="gray">{formatDate(r.submittedAt ?? r.createdAt)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={STATUS_COLOR[r.status]} radius="full" size="1">
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap="2">
                          <Button
                            size="1"
                            variant="soft"
                            color="gray"
                            onClick={() => setDetailTarget(r)}
                          >
                            View
                          </Button>
                          {r.status === 'pending' && (
                            <>
                              <Button
                                size="1"
                                variant="soft"
                                color="green"
                                onClick={() => { setApproveTarget(r); setApproveError(null); }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="1"
                                variant="soft"
                                color="red"
                                onClick={() => {
                                  setRejectTarget(r);
                                  setRejectNote('');
                                  setRejectSendEmail(true);
                                  setRejectError(null);
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>

            {/* Pagination */}
            <Flex
              justify="between"
              align="center"
              p="3"
              style={{ borderTop: '1px solid var(--gray-a4)', backgroundColor: 'var(--gray-2)' }}
            >
              <Text size="1" color="gray">Page {page} of {totalPages}</Text>
              <Flex gap="2">
                <Button
                  variant="soft"
                  color="gray"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeftIcon /> Prev
                </Button>
                <Button
                  variant="soft"
                  color="gray"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      </Flex>

      {/* ── Detail dialog ──────────────────────────────────────────────── */}
      <Dialog.Root open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>{detailTarget?.brandName || 'Application'}</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Applied {formatDate(detailTarget?.submittedAt ?? detailTarget?.createdAt)}
          </Dialog.Description>

          {detailTarget && (
            <Flex direction="column" gap="3">
              <Box>
                <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Applicant
                </Text>
                <Text size="2" style={{ display: 'block' }}>{detailTarget.userName}</Text>
                <Text size="2" color="gray">{detailTarget.userEmail}</Text>
              </Box>

              {detailTarget.website && (
                <Box>
                  <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Website {" "}
                  </Text>
                  <a
                    href={detailTarget.website.startsWith('http') ? detailTarget.website : `https://${detailTarget.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-11)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Text size="2">{detailTarget.website}</Text>
                    <ExternalLinkIcon />
                  </a>
                </Box>
              )}

              {detailTarget.description && (
                <Box>
                  <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Description
                  </Text>
                  <Text size="2" style={{ lineHeight: 1.6, display: 'block', marginTop: 4 }}>
                    {detailTarget.description}
                  </Text>
                </Box>
              )}

              <Box>
                <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Shopify confirmed
                </Text>
                <Text size="2" style={{ display: 'block' }}>
                  {detailTarget.shopifyConfirmed ? 'Yes' : 'No'}
                </Text>
              </Box>

              {detailTarget.reviewNote && (
                <Box>
                  <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Review note
                  </Text>
                  <Text size="2" style={{ lineHeight: 1.6, display: 'block', marginTop: 4 }}>
                    {detailTarget.reviewNote}
                  </Text>
                </Box>
              )}
            </Flex>
          )}

          <Flex gap="3" justify="end" mt="5">
            <Dialog.Close>
              <Button variant="soft" color="gray">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ── Approve dialog ─────────────────────────────────────────────── */}
      <Dialog.Root open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Approve application</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            This will create the <Text weight="bold">{approveTarget?.brandName}</Text> brand
            and send <Text weight="bold">{approveTarget?.userEmail}</Text> a setup link to
            access their admin dashboard.
          </Dialog.Description>

          {approveError && (
            <Callout.Root color="red" mb="3" size="1">
              <Callout.Text>{approveError}</Callout.Text>
            </Callout.Root>
          )}

          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="green" onClick={handleApprove} disabled={approving}>
              {approving ? <Spinner size="1" /> : null}
              {approving ? 'Approving…' : 'Confirm approve'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ── Reject dialog ──────────────────────────────────────────────── */}
      <Dialog.Root open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <Dialog.Content maxWidth="440px">
          <Dialog.Title>Reject application</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            You're rejecting <Text weight="bold">{rejectTarget?.brandName}</Text>.
          </Dialog.Description>

          {rejectError && (
            <Callout.Root color="red" mb="3" size="1">
              <Callout.Text>{rejectError}</Callout.Text>
            </Callout.Root>
          )}

          <Box mb="4">
            <Text size="2" weight="medium" mb="1">Reason (optional, included in email if sent)</Text>
            <TextArea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. We're not currently accepting brands in this category."
              rows={3}
            />
          </Box>

          <Box mb="4">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Checkbox
                size="2"
                checked={rejectSendEmail}
                onCheckedChange={(c) => setRejectSendEmail(!!c)}
              />
              <Text size="2">Send rejection email via template</Text>
            </label>
            <Text size="1" color="gray" style={{ display: 'block', marginTop: 4, marginLeft: 28 }}>
              Uncheck if you'll email them personally.
            </Text>
          </Box>

          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={handleReject} disabled={rejecting}>
              {rejecting ? <Spinner size="1" /> : null}
              {rejecting ? 'Rejecting…' : 'Confirm reject'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}