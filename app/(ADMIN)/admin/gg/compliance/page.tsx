'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Flex, Heading, Text, Badge, Button, Spinner,
  Callout, Table, Dialog, TextArea,
} from '@radix-ui/themes';
import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { AlertCircle } from 'lucide-react';
import { DateTime } from 'luxon';

interface ComplianceRequest {
  _id: string;
  topic: 'customers/data_request' | 'customers/redact' | 'shop/redact';
  shopDomain: string;
  customerId?: number;
  customerEmail?: string;
  ordersReferenced?: number[];
  status: 'pending' | 'completed';
  receivedAt: string;
  dueAt: string;
  completedAt?: string;
  notes?: string;
}

const TOPIC_LABELS: Record<ComplianceRequest['topic'], string> = {
  'customers/data_request': 'Data Request',
  'customers/redact': 'Customer Redact',
  'shop/redact': 'Shop Redact',
};

const TOPIC_COLORS: Record<ComplianceRequest['topic'], 'green' | 'red' | 'blue'> = {
  'customers/data_request': 'blue',
  'customers/redact': 'green',
  'shop/redact': 'red',
};

const formatDate = (iso: string) =>
  DateTime.fromISO(iso).toFormat('MMM d, yyyy · h:mm a');

const isOverdue = (dueAt: string) =>
  DateTime.fromISO(dueAt) < DateTime.now();

const isDueSoon = (dueAt: string) => {
  const due = DateTime.fromISO(dueAt);
  const now = DateTime.now();
  return due > now && due.diff(now, 'days').days < 5;
};

export default function CompliancePage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  const [completeTargetId, setCompleteTargetId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/compliance?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setRequests(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleComplete = async () => {
    if (!completeTargetId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/admin/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: completeTargetId, note: completionNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to mark complete');
      setCompleteTargetId(null);
      setCompletionNote('');
      loadRequests();
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setCompleting(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const overdueCount = requests.filter(r => r.status === 'pending' && isOverdue(r.dueAt)).length;

  return (
    <Flex direction="column" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>

      <Flex justify="between" align="center" px="6" style={{
        height: 64,
        backgroundColor: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Flex align="center" gap="3">
          <Text weight="bold" size="3" style={{ color: '#fff' }}>Compliance</Text>
          {pendingCount > 0 && (
            <Badge color={overdueCount > 0 ? 'red' : 'amber'} variant="solid" radius="full">
              {pendingCount} pending
            </Badge>
          )}
        </Flex>
        <Flex align="center" gap="2">
          <Button variant="soft" color="gray" size="2" onClick={loadRequests} style={{ cursor: 'pointer' }}>
            <ReloadIcon /> Refresh
          </Button>
          <Button variant="soft" color="gray" size="2" onClick={() => router.push('/admin/gg')} style={{ cursor: 'pointer' }}>
            ← Back
          </Button>
        </Flex>
      </Flex>

      <Box px="6" py="7">
        <Flex direction="column" gap="6" style={{ maxWidth: 1000, margin: '0 auto' }}>

          <Heading size="6" style={{ color: '#fff' }}>Shopify Compliance Queue</Heading>

          {overdueCount > 0 && (
            <Box style={{
              background: 'rgba(239,68,68,0.08)',
              border: '0.5px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: '14px 18px',
            }}>
              <Flex align="center" gap="3">
                <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
                <Text size="2" style={{ color: '#f87171' }}>
                  <Text weight="bold">{overdueCount} request{overdueCount > 1 ? 's are' : ' is'} overdue.</Text>{' '}
                  Shopify compliance deadlines have passed. Action required immediately.
                </Text>
              </Flex>
            </Box>
          )}

          <Box style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 18px',
          }}>
            <Text size="2" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
              Shopify sends compliance webhooks when merchants uninstall the app or when customers
              request their data or deletion.{' '}
              <Text weight="bold" style={{ color: 'rgba(255,255,255,0.8)' }}>Shop redacts</Text> are
              handled automatically — credentials are cleared on receipt.{' '}
              <Text weight="bold" style={{ color: 'rgba(255,255,255,0.8)' }}>Customer data requests</Text> and{' '}
              <Text weight="bold" style={{ color: 'rgba(255,255,255,0.8)' }}>customer redacts</Text> require
              manual action within 30 days — email the customer their data or confirm deletion,
              then mark the request complete here.
            </Text>
          </Box>

          {error && (
            <Callout.Root color="red">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Flex justify="between" align="center" gap="4" style={{ flex: 1 }}>
                <Callout.Text>{error}</Callout.Text>
                <Button size="1" variant="soft" color="red" onClick={loadRequests} style={{ cursor: 'pointer' }}>
                  <ReloadIcon /> Retry
                </Button>
              </Flex>
            </Callout.Root>
          )}

          <Flex gap="2">
            {(['pending', 'completed', 'all'] as const).map((f) => (
              <Button
                key={f}
                size="2"
                variant={statusFilter === f ? 'solid' : 'soft'}
                color={statusFilter === f ? 'green' : undefined}
                onClick={() => setStatusFilter(f)}
                style={{ cursor: 'pointer', textTransform: 'capitalize' }}
              >
                {f}
              </Button>
            ))}
          </Flex>

          <Box style={{
            background: '#111',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <Table.Root>
              <Table.Header>
                <Table.Row style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                  {['Type', 'Shop', 'Customer', 'Received', 'Due', 'Status', ''].map((h) => (
                    <Table.ColumnHeaderCell key={h} style={{
                      color: 'rgba(255,255,255,0.5)', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500,
                    }}>
                      {h}
                    </Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loading ? (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Flex justify="center" p="6"><Spinner style={{ color: '#a3e635' }} /></Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : requests.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Flex direction="column" align="center" py="8" gap="2">
                        <CheckCircledIcon color="#4ade80" width={28} height={28} />
                        <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {statusFilter === 'pending' ? 'No pending compliance requests.' : 'No requests found.'}
                        </Text>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ) : requests.map((req) => {
                  const overdue = req.status === 'pending' && isOverdue(req.dueAt);
                  const dueSoon = req.status === 'pending' && isDueSoon(req.dueAt);
                  return (
                    <Table.Row key={req._id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <Table.Cell>
                        <Badge color={TOPIC_COLORS[req.topic]} variant="soft" radius="full">
                          {TOPIC_LABELS[req.topic]}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                          {req.shopDomain}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Text size="2" style={{ color: '#fff' }}>{req.customerEmail ?? '—'}</Text>
                          {req.customerId && (
                            <Text size="1" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                              ID: {req.customerId}
                            </Text>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {formatDate(req.receivedAt)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Text size="2" style={{
                            color: overdue ? '#f87171' : dueSoon ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                            fontWeight: overdue || dueSoon ? 'bold' : 'normal',
                          }}>
                            {formatDate(req.dueAt)}
                          </Text>
                          {overdue && <Text size="1" style={{ color: '#f87171' }}>Overdue</Text>}
                          {dueSoon && !overdue && <Text size="1" style={{ color: '#fbbf24' }}>Due soon</Text>}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        {req.status === 'completed' ? (
                          <Flex align="center" gap="1">
                            <CheckCircledIcon color="#4ade80" />
                            <Text size="2" style={{ color: '#4ade80' }}>Complete</Text>
                          </Flex>
                        ) : (
                          <Badge color="amber" variant="soft" radius="full">Pending</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {req.status === 'pending' && req.topic !== 'shop/redact' && (
                          <Button
                            size="1"
                            variant="soft"
                            color="green"
                            onClick={() => {
                              setCompleteTargetId(req._id);
                              setCompletionNote('');
                              setCompleteError(null);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </Flex>
      </Box>

      <Dialog.Root open={!!completeTargetId} onOpenChange={(open) => { if (!open) setCompleteTargetId(null); }}>
        <Dialog.Content style={{ maxWidth: 480, backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <Dialog.Title style={{ color: '#fff' }}>Mark request complete</Dialog.Title>
          <Dialog.Description size="2" mb="4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Confirm you have fulfilled this compliance request. Add a note describing what action
            was taken (e.g. "Emailed customer their data" or "Deleted customer records from DB").
          </Dialog.Description>
          {completeError && (
            <Callout.Root color="red" mb="3"><Callout.Text>{completeError}</Callout.Text></Callout.Root>
          )}
          <TextArea
            placeholder="Describe the action taken…"
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            rows={3}
            mb="4"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#000000' }}
          />
          <Flex gap="3" justify="end">
            <Button variant="soft" onClick={() => setCompleteTargetId(null)} style={{ cursor: 'pointer' }}>
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleComplete}
              disabled={completing || !completionNote.trim()}
              style={{ cursor: completing ? 'default' : 'pointer' }}
            >
              {completing ? <><Spinner size="1" /> Saving…</> : 'Mark Complete'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </Flex>
  );
}