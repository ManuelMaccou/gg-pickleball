'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge, Box, Button, Callout, Card, Dialog, Flex, Progress, Spinner,
  Table, Text, TextField,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon, Pencil1Icon,
} from '@radix-ui/react-icons';

type PlayerRow = {
  rowNumber: number;
  name?: string;
  email?: string;
  duprId?: string;
  dateOfBirth?: string;
  age?: number;
  isUnder13: boolean;
  validationErrors: string[];
  warnings: string[];
};

type PreviewResponse = {
  previewId: string;
  fileErrors: string[];
  totalRows: number;
  errorRowCount: number;
  under13Count: number;
  confirmedAt: string | null;
  rows: PlayerRow[];
  totalEligible?: number;
  processedCount?: number;
  done?: boolean;
};

interface PlayersUploadSectionProps {
  programId: string;
}

function ExampleFieldsTable() {
  return (
    <Table.Root variant="surface" size="1">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>DUPR ID</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Date of Birth</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Age</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Jane Smith</Table.Cell>
          <Table.Cell>jane@example.com</Table.Cell>
          <Table.Cell>1234567</Table.Cell>
          <Table.Cell>1998-04-12</Table.Cell>
          <Table.Cell style={{ color: 'var(--gray-8)' }}>(leave blank)</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Sam Lee</Table.Cell>
          <Table.Cell>sam@example.com</Table.Cell>
          <Table.Cell>7654321</Table.Cell>
          <Table.Cell style={{ color: 'var(--gray-8)' }}>(leave blank)</Table.Cell>
          <Table.Cell>27</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
}

export default function PlayersUploadSection({ programId }: PlayersUploadSectionProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingRow, setEditingRow] = useState<PlayerRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', duprId: '', dateOfBirth: '', age: '' });
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [rowSaveError, setRowSaveError] = useState<string | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const wasConfirmedRef = useRef(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const pollFailureCountRef = useRef(0);

  const fetchCurrent = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      try {
        const r = await fetch(`/api/admin/programs/${programId}/players-upload`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load upload status.');

        const next: PreviewResponse | null = d.preview === null ? null : d;
        if (next?.confirmedAt) wasConfirmedRef.current = true;
        if (next === null && wasConfirmedRef.current) setJustCompleted(true);
        setPreview(next);

        pollFailureCountRef.current = 0;
        setPollWarning(null);
        setFetchError(null);
        return true;
      } catch (err) {
        console.error('[PlayersUploadSection] fetchCurrent failed', err);
        if (opts?.silent) {
          pollFailureCountRef.current += 1;

          if (pollFailureCountRef.current >= 3) {
            setPollWarning('Having trouble checking progress — will keep trying.');
          }
        } else {
          setFetchError(err instanceof Error ? err.message : 'Failed to load upload status.');
        }
        return false;
      }
    },
    [programId]
  );

  useEffect(() => {
    (async () => {
      setIsLoadingInitial(true);
      await fetchCurrent();
      setIsLoadingInitial(false);
    })();
  }, [fetchCurrent]);

  // Poll while confirmed but not yet done — safe to close the browser and
  // come back; this just resumes watching.
  useEffect(() => {
    if (!preview?.confirmedAt || preview?.done) return;
    const interval = setInterval(() => fetchCurrent({ silent: true }), 3000);
    return () => clearInterval(interval);
  }, [preview?.confirmedAt, preview?.done, fetchCurrent]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const csvText = await file.text();
      const r = await fetch(`/api/admin/programs/${programId}/players-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to upload file');
      wasConfirmedRef.current = false;
      setJustCompleted(false);
      setPreview(d);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEditDialog = (row: PlayerRow) => {
    setEditingRow(row);
    setEditForm({
      name: row.name || '',
      email: row.email || '',
      duprId: row.duprId || '',
      dateOfBirth: row.dateOfBirth || '',
      age: row.age !== undefined ? String(row.age) : '',
    });
    setRowSaveError(null);
  };

  const handleSaveRow = async () => {
    if (!editingRow) return;
    setIsSavingRow(true);
    setRowSaveError(null);
    try {
      const r = await fetch(
        `/api/admin/programs/${programId}/players-upload/rows/${editingRow.rowNumber}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editForm.name,
            email: editForm.email,
            duprId: editForm.duprId,
            dateOfBirth: editForm.dateOfBirth,
            age: editForm.age === '' ? undefined : Number(editForm.age),
          }),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save row');
      setPreview(d);
      setEditingRow(null);
    } catch (err: unknown) {
      setRowSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSavingRow(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const r = await fetch(`/api/admin/programs/${programId}/players-upload/confirm`, {
        method: 'POST',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to confirm');

      // Update local state immediately from the confirm response itself,
      // rather than waiting on a second network round-trip to learn
      // confirmedAt. This is what actually prevents the screen getting
      // stuck showing the old editable table — previously, a confirm could
      // succeed server-side while the UI still looked exactly like nothing
      // had happened yet, if the follow-up fetch hiccuped for any reason.
      wasConfirmedRef.current = true;
      setPreview((prev) =>
        prev
          ? { ...prev, confirmedAt: d.confirmedAt, totalEligible: d.eligibleRowCount, processedCount: 0, done: false }
          : prev
      );

      const refreshed = await fetchCurrent();
      if (!refreshed) {
        setConfirmError(
          "Processing started, but couldn't load live progress yet — it'll pick up on the next automatic check."
        );
      }
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsConfirming(false);
    }
  };

  const canConfirm =
    !!preview && preview.fileErrors.length === 0 && preview.errorRowCount === 0 && !preview.confirmedAt;

  const uploadPrompt = (
    <Box>
      <Text as="div" size="2" weight="bold" mb="2">Upload players CSV</Text>
      <Text as="div" size="2" color="gray" mb="2">
        Expected columns — provide exactly one of Date of Birth (YYYY-MM-DD) or Age per row,
        not both. Under-13 rows can leave Name, Email, and DUPR ID blank; no account is
        created for them.
      </Text>
      <ExampleFieldsTable />
      <Flex align="center" gap="3" mt="3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        {isUploading && <Spinner size="2" />}
      </Flex>
      {uploadError && (
        <Callout.Root color="red" size="1" mt="2">
          <Callout.Text>{uploadError}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );

  if (isLoadingInitial) {
    return (
      <Flex align="center" gap="2">
        <Spinner size="2" /> <Text size="2" color="gray">Checking for an existing upload…</Text>
      </Flex>
    );
  }

  // Actively processing — confirmed, not yet done.
  if (preview?.confirmedAt && !preview.done) {
    const total = preview.totalEligible ?? 0;
    const done = preview.processedCount ?? 0;
    return (
      <Card size="2" style={{ maxWidth: 480 }}>
        <Flex direction="column" gap="3">
          <Text as="div" weight="bold">Creating player accounts…</Text>
          <Progress value={total > 0 ? Math.round((done / total) * 100) : 0} />
          <Text size="2" color="gray">
            {done} of {total} processed. Safe to close this page — it'll keep running and
            pick up here if you come back.
          </Text>
          {pollWarning && (
            <Callout.Root color="amber" size="1">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{pollWarning}</Callout.Text>
            </Callout.Root>
          )}
        </Flex>
      </Card>
    );
  }

  // Nothing in progress — either never uploaded, or just finished.
  if (!preview || preview.done) {
    return (
      <Flex direction="column" gap="3">
        {fetchError && (
          <Callout.Root color="red" size="1">
            <Callout.Text>{fetchError}</Callout.Text>
          </Callout.Root>
        )}
        {(preview?.done || justCompleted) && (
          <Callout.Root color="green" size="1">
            <Callout.Icon><CheckCircledIcon /></Callout.Icon>
            <Callout.Text>All eligible player accounts created.</Callout.Text>
          </Callout.Root>
        )}
        {uploadPrompt}
      </Flex>
    );
  }

  // Awaiting review — uploaded, not yet confirmed.
  return (
    <Flex direction="column" gap="4">
      {uploadPrompt}

      <Box>
        <Flex gap="3" wrap="wrap" mb="3">
          <Badge variant="soft" size="1">{preview.totalRows} rows</Badge>
          {preview.errorRowCount > 0 && (
            <Badge color="red" variant="soft" size="1">{preview.errorRowCount} need fixes</Badge>
          )}
          {preview.under13Count > 0 && (
            <Badge color="gray" variant="soft" size="1">{preview.under13Count} under 13 (will skip)</Badge>
          )}
        </Flex>

        {preview.fileErrors.length > 0 && (
          <Callout.Root color="red" mb="3">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>
              <Flex direction="column" gap="1">
                {preview.fileErrors.map((e, i) => <Text key={i} size="2">{e}</Text>)}
              </Flex>
            </Callout.Text>
          </Callout.Root>
        )}

        <Card size="2" style={{ padding: 0, overflow: 'hidden' }}>
          <Table.Root variant="surface" size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>#</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>DUPR ID</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>DOB / Age</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {preview.rows.map((row) => (
                <Table.Row
                  key={row.rowNumber}
                  style={row.validationErrors.length > 0 ? { backgroundColor: 'var(--red-a2)' } : undefined}
                >
                  <Table.Cell>{row.rowNumber}</Table.Cell>
                  <Table.Cell>{row.name || '—'}</Table.Cell>
                  <Table.Cell>{row.email || '—'}</Table.Cell>
                  <Table.Cell>{row.duprId || '—'}</Table.Cell>
                  <Table.Cell>
                    {row.dateOfBirth || (row.age !== undefined ? `${row.age} yrs` : '—')}
                  </Table.Cell>
                  <Table.Cell>
                    <Flex direction="column" gap="1">
                      {row.isUnder13 && (
                        <Badge color="gray" variant="soft" size="1">Under 13 — will skip</Badge>
                      )}
                      {row.validationErrors.map((e, i) => (
                        <Flex key={i} align="center" gap="1">
                          <ExclamationTriangleIcon color="var(--red-9)" width={12} height={12} />
                          <Text size="1" color="red">{e}</Text>
                        </Flex>
                      ))}
                      {row.warnings.map((w, i) => (
                        <Flex key={i} align="center" gap="1">
                          <InfoCircledIcon color="var(--amber-9)" width={12} height={12} />
                          <Text size="1" color="amber">{w}</Text>
                        </Flex>
                      ))}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Button size="1" variant="soft" color="gray" onClick={() => openEditDialog(row)}>
                      <Pencil1Icon /> Edit
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card>

        <Flex align="center" gap="3" mt="4">
          <Button onClick={handleConfirm} disabled={!canConfirm} loading={isConfirming}>
            Confirm &amp; Create Accounts
          </Button>
          {!canConfirm && (preview.errorRowCount > 0 || preview.fileErrors.length > 0) && (
            <Text size="2" color="gray">Fix all errors above before confirming.</Text>
          )}
        </Flex>
        {confirmError && (
          <Callout.Root color="red" size="1" mt="2">
            <Callout.Text>{confirmError}</Callout.Text>
          </Callout.Root>
        )}
      </Box>

      <Dialog.Root open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Edit Row {editingRow?.rowNumber}</Dialog.Title>
          {rowSaveError && (
            <Callout.Root color="red" size="1" mb="3">
              <Callout.Text>{rowSaveError}</Callout.Text>
            </Callout.Root>
          )}
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Name</Text>
              <TextField.Root
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Email</Text>
              <TextField.Root
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">DUPR ID</Text>
              <TextField.Root
                value={editForm.duprId}
                onChange={(e) => setEditForm((f) => ({ ...f, duprId: e.target.value }))}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Date of Birth</Text>
              <TextField.Root
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    dateOfBirth: e.target.value,
                    age: e.target.value ? '' : f.age, // exactly one of the two — clear the other
                  }))
                }
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Age</Text>
              <TextField.Root
                type="number"
                value={editForm.age}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    age: e.target.value,
                    dateOfBirth: e.target.value ? '' : f.dateOfBirth,
                  }))
                }
              />
            </label>
            <Text size="1" color="gray">Provide exactly one of Date of Birth or Age.</Text>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button variant="soft" color="gray" type="button">Cancel</Button></Dialog.Close>
            <Button onClick={handleSaveRow} loading={isSavingRow}>Save</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}