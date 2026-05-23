'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Box, Button, Card, Callout, Flex, Heading,
  Spinner, Table, Text,
} from '@radix-ui/themes';
import { useUserContext } from '@/app/contexts/UserContext';
import { CheckCircledIcon, ChevronLeftIcon, ChevronRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandPageShell } from '../../components/BrandPageShell';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const formatDate = (s: string) =>
  s ? new Date(s).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : '—';

type CommissionStatus = 'pending' | 'held' | 'charged' | 'waived' | 'review';

const STATUS_COLOR: Record<CommissionStatus, 'gray' | 'amber' | 'green' | 'red' | 'orange'> = {
  pending: 'gray', held: 'amber', charged: 'green', waived: 'red', review: 'orange',
};

const STATUS_LABEL: Record<CommissionStatus, string> = {
  pending: 'Upcoming', held: 'On hold', charged: 'Charged', waived: 'Waived', review: 'Under review',
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BrandBillingPage() {
  const { user } = useUserContext();
  const router = useRouter();

  // Admin/location lookup for the shell sidebar
  const [location, setLocation] = useState<IClient | null>(null);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState(true);

  // Commission history
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<{
    totalCharged: number; totalPending: number;
    countCharged: number; countPending: number;
  } | null>(null);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionTotalPages, setCommissionTotalPages] = useState(1);

  // Auth + admin fetch
  useEffect(() => {
    if (!user?.id) {
      router.push('/auth/login?returnTo=/admin/brand/billing');
      return;
    }
    fetch(`/api/admin?userId=${user.id}`)
      .then((r) => (r.status === 204 ? null : r.json()))
      .then((data) => {
        if (data?.admin?.permission) setAdminPermission(data.admin.permission);
        if (data?.location) setLocation(data.location);
      })
      .catch(() => {})
      .finally(() => setIsGettingAdmin(false));
  }, [user, router]);

  const fetchCommissions = useCallback(async () => {
    setCommissionsLoading(true);
    try {
      const res = await fetch(`/api/billing/commissions?page=${commissionPage}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommissions(data.records);
      setCommissionSummary(data.summary);
      setCommissionTotalPages(data.pagination.totalPages);
    } catch {
      setCommissions([]);
    } finally {
      setCommissionsLoading(false);
    }
  }, [commissionPage]);

  useEffect(() => {
    if (user) fetchCommissions();
  }, [user, fetchCommissions]);

  if (isGettingAdmin) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <BrandPageShell adminPermission={adminPermission} location={location}>
      <Heading size="6">Billing</Heading>

      {/* Summary cards */}
      {commissionSummary && (commissionSummary.countCharged > 0 || commissionSummary.countPending > 0) && (
        <Flex gap="4">
          <Card size="2" style={{ flex: 1 }}>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">Total charged</Text>
              <Text size="5" weight="bold">{formatCurrency(commissionSummary.totalCharged)}</Text>
              <Text size="1" color="gray">
                {commissionSummary.countCharged} order{commissionSummary.countCharged !== 1 ? 's' : ''}
              </Text>
            </Flex>
          </Card>
          <Card size="2" style={{ flex: 1 }}>
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">Upcoming</Text>
              <Text size="5" weight="bold">{formatCurrency(commissionSummary.totalPending)}</Text>
              <Text size="1" color="gray">
                {commissionSummary.countPending} pending
              </Text>
            </Flex>
          </Card>
        </Flex>
      )}

      {/* Shopify billing note — replaces the old payment method card */}
      <Card size="3">
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Heading size="4">Billing</Heading>
            <Badge color="green" variant="soft">
              <CheckCircledIcon /> Managed by Shopify
            </Badge>
          </Flex>
          <Callout.Root color="blue" size="1">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>
              Commissions are billed automatically through your Shopify subscription.
              You can view all billing activity and charges in your Shopify Dashboard.
            </Callout.Text>
          </Callout.Root>
          <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
            A 5% commission on each redeemed sale is reported to Shopify 30 days after
            the order date. Shopify collects this as part of your app subscription billing.
            No payment method is required here.
          </Text>
          <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
            If a return or dispute is initiated within 30 days of a sale, that order's
            commission is adjusted or waived accordingly before being reported.
          </Text>

          <Button asChild size="2" variant="outline" style={{ alignSelf: 'flex-start' }}>
            
              <a href={`https://admin.shopify.com/store/${location?.shopify?.shopDomain?.replace('.myshopify.com', '')}/charges/${process.env.NEXT_PUBLIC_SHOPIFY_APP_HANDLE ?? 'gg-pickleball-3'}/pricing_plans`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage plan ↗
              </a>
          </Button>
        </Flex>
      </Card>

      {/* Commission history */}
      <Card size="3" style={{ padding: 0, overflow: 'hidden' }}>
        <Box px="4" py="3" style={{ borderBottom: '1px solid var(--gray-4)' }}>
          <Heading size="4">Commission History</Heading>
          <Text size="2" color="gray">
            A record of all commissions from orders using your GG promo codes.
          </Text>
        </Box>

        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Order</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Sale</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Commission</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Due / Charged</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {commissionsLoading ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Flex justify="center" p="5"><Spinner size="2" /></Flex>
                </Table.Cell>
              </Table.Row>
            ) : commissions.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="gray" align="center" my="4">
                    No commissions yet. They'll appear here when customers use your promo codes.
                  </Text>
                </Table.Cell>
              </Table.Row>
            ) : (
              commissions.map((r) => (
                <Table.Row key={r._id}>
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
                        <Text size="1" color="red">
                          -{formatCurrency(r.refundedAmount)} refunded
                        </Text>
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="medium">{formatCurrency(r.commissionAmount)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {r.status === 'charged'
                        ? formatDate(r.updatedAt)
                        : formatDate(r.chargeAfter)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={STATUS_COLOR[r.status as CommissionStatus]}
                      radius="full"
                      size="1"
                    >
                      {STATUS_LABEL[r.status as CommissionStatus] ?? r.status}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>

        {commissionTotalPages > 1 && (
          <Flex
            justify="between" align="center" px="4" py="3"
            style={{ borderTop: '1px solid var(--gray-a4)', backgroundColor: 'var(--gray-2)' }}
          >
            <Text size="1" color="gray">
              Page {commissionPage} of {commissionTotalPages}
            </Text>
            <Flex gap="2">
              <Button
                variant="soft" color="gray" size="1"
                disabled={commissionPage === 1}
                onClick={() => setCommissionPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon /> Prev
              </Button>
              <Button
                variant="soft" color="gray" size="1"
                disabled={commissionPage === commissionTotalPages}
                onClick={() => setCommissionPage((p) => Math.min(commissionTotalPages, p + 1))}
              >
                Next <ChevronRightIcon />
              </Button>
            </Flex>
          </Flex>
        )}
      </Card>
    </BrandPageShell>
  );
}