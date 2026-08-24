'use client';

// Destination: app/(ADMIN)/admin/components/MatchesUploadSection.tsx
//
// [Under-13 handling] warnings added to MatchRow type and surfaced in the
// Status column (amber, distinct from red validationErrors) — see
// validateMatchRow.ts for what triggers these. Row background now also
// distinguishes "has warnings but no errors" (amber) from "has errors"
// (red, unchanged) from neither (unchanged).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge, Box, Button, Callout, Card, Dialog, Flex, Progress, Select, Spinner,
  Table, Text, TextField,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon, Pencil1Icon,
} from '@radix-ui/react-icons';

type PlayerSlotStatus = {
  duprId: string;
  matched: boolean;
  name?: string;
};

type MatchRow = {
  rowNumber: number;
  sourceMatchId?: string;
  division?: string;
  matchType?: 'singles' | 'doubles';
  matchDate?: string;
  team1Score?: number;
  team2Score?: number;
  team1Player1DuprId?: string;
  team1Player2DuprId?: string;
  team2Player1DuprId?: string;
  team2Player2DuprId?: string;
  validationErrors: string[];
  // [Under-13 handling] NEW — non-blocking. See validateMatchRow.ts.
  warnings: string[];
  // Live-enriched, computed fresh on every fetch — see enrichMatchRows.ts.
  alreadyProcessed: boolean;
  team1Player1Match?: PlayerSlotStatus;
  team1Player2Match?: PlayerSlotStatus;
  team2Player1Match?: PlayerSlotStatus;
  team2Player2Match?: PlayerSlotStatus;
};

type PreviewResponse = {
  previewId: string;
  fileErrors: string[];
  totalRows: number;
  errorRowCount: number;
  confirmedAt: string | null;
  rows: MatchRow[];
  totalEligible?: number;
  processedCount?: number;
  done?: boolean;
};

interface MatchesUploadSectionProps {
  programId: string;
}

// Static, no closure dependencies — kept as real top-level components
// rather than nested inside MatchesUploadSection, so neither is redefined
// (and remounted) on every render.
function ExampleFieldsTable() {
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table.Root variant="surface" size="1">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Source Match ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Division</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Match Type</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Match Date</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 1 Score</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 2 Score</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 1 Player 1 DUPR ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 1 Player 2 DUPR ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 2 Player 1 DUPR ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Team 2 Player 2 DUPR ID</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>20260815-7734</Table.Cell>
            <Table.Cell>3.5 Mixed Doubles</Table.Cell>
            <Table.Cell>doubles</Table.Cell>
            <Table.Cell>2026-08-15</Table.Cell>
            <Table.Cell>11</Table.Cell>
            <Table.Cell>7</Table.Cell>
            <Table.Cell>1234567</Table.Cell>
            <Table.Cell>2345678</Table.Cell>
            <Table.Cell>3456789</Table.Cell>
            <Table.Cell>4567890</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>20260815-9021</Table.Cell>
            <Table.Cell>4.0 Singles</Table.Cell>
            <Table.Cell>singles</Table.Cell>
            <Table.Cell>2026-08-15</Table.Cell>
            <Table.Cell>11</Table.Cell>
            <Table.Cell>9</Table.Cell>
            <Table.Cell>5678901</Table.Cell>
            <Table.Cell style={{ color: 'var(--gray-8)' }}>(leave blank)</Table.Cell>
            <Table.Cell>6789012</Table.Cell>
            <Table.Cell style={{ color: 'var(--gray-8)' }}>(leave blank)</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function PlayerSlotCell({ duprId, match }: { duprId?: string; match?: PlayerSlotStatus }) {
  if (!duprId) {
    return <Text size="1" color="gray">—</Text>;
  }
  return (
    <Flex direction="column" gap="0">
      <Text size="2" style={{ fontFamily: 'monospace' }}>{duprId}</Text>
      {match?.matched ? (
        <Text size="1" color="green">✓ {match.name || 'Matched'}</Text>
      ) : (
        <Text size="1" color="gray">Not on roster — will skip</Text>
      )}
    </Flex>
  );
}

const formatDate = (isoDateStr?: string): string => {
  if (!isoDateStr) return '—';
  const d = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function MatchesUploadSection({ programId }: MatchesUploadSectionProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingRow, setEditingRow] = useState<MatchRow | null>(null);
  const [editForm, setEditForm] = useState({
    sourceMatchId: '', division: '', matchType: '' as '' | 'singles' | 'doubles',
    matchDate: '', team1Score: '', team2Score: '',
    team1Player1DuprId: '', team1Player2DuprId: '',
    team2Player1DuprId: '', team2Player2DuprId: '',
  });
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [rowSaveError, setRowSaveError] = useState<string | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const pollFailureCountRef = useRef(0);

  const wasConfirmedRef = useRef(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const fetchCurrent = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      try {
        const r = await fetch(`/api/admin/programs/${programId}/matches-upload`);
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
        console.error('[MatchesUploadSection] fetchCurrent failed', err);
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
      const r = await fetch(`/api/admin/programs/${programId}/matches-upload`, {
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

  const openEditDialog = (row: MatchRow) => {
    setEditingRow(row);
    setEditForm({
      sourceMatchId: row.sourceMatchId || '',
      division: row.division || '',
      matchType: row.matchType || '',
      matchDate: row.matchDate || '',
      team1Score: row.team1Score !== undefined ? String(row.team1Score) : '',
      team2Score: row.team2Score !== undefined ? String(row.team2Score) : '',
      team1Player1DuprId: row.team1Player1DuprId || '',
      team1Player2DuprId: row.team1Player2DuprId || '',
      team2Player1DuprId: row.team2Player1DuprId || '',
      team2Player2DuprId: row.team2Player2DuprId || '',
    });
    setRowSaveError(null);
  };

  const handleSaveRow = async () => {
    if (!editingRow) return;
    setIsSavingRow(true);
    setRowSaveError(null);
    try {
      const r = await fetch(
        `/api/admin/programs/${programId}/matches-upload/rows/${editingRow.rowNumber}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceMatchId: editForm.sourceMatchId,
            division: editForm.division,
            matchType: editForm.matchType || undefined,
            matchDate: editForm.matchDate,
            team1Score: editForm.team1Score === '' ? undefined : Number(editForm.team1Score),
            team2Score: editForm.team2Score === '' ? undefined : Number(editForm.team2Score),
            team1Player1DuprId: editForm.team1Player1DuprId,
            team1Player2DuprId: editForm.team1Player2DuprId,
            team2Player1DuprId: editForm.team2Player1DuprId,
            team2Player2DuprId: editForm.team2Player2DuprId,
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
      const r = await fetch(`/api/admin/programs/${programId}/matches-upload/confirm`, {
        method: 'POST',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to confirm');

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
      <Text as="div" size="2" weight="bold" mb="2">Upload matches CSV</Text>
      <Text as="div" size="2" color="gray" mb="2">
        Expected columns — every row is one game. Player 2 columns are only required for
        doubles; leave them blank for singles. A DUPR ID that doesn't match anyone on the
        roster is treated as under 13 and skipped automatically, not an error. A blank
        required slot (e.g. an under-13 participant already removed from the raw data
        before this CSV was built) is flagged as a warning, not an error — review it, but
        it won't block confirming.
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
          <Text as="div" weight="bold">Processing matches…</Text>
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
            <Callout.Text>All eligible matches processed.</Callout.Text>
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
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root variant="surface" size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>#</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Source Match ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Division</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T1 Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T2 Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T1 Player 1</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T1 Player 2</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T2 Player 1</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>T2 Player 2</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {preview.rows.map((row) => {
                  const hasErrors = row.validationErrors.length > 0;
                  const hasWarnings = (row.warnings?.length ?? 0) > 0;
                  return (
                    <Table.Row
                      key={row.rowNumber}
                      style={
                        hasErrors
                          ? { backgroundColor: 'var(--red-a2)' }
                          : hasWarnings
                          ? { backgroundColor: 'var(--amber-a2)' }
                          : undefined
                      }
                    >
                      <Table.Cell>{row.rowNumber}</Table.Cell>
                      <Table.Cell style={{ fontFamily: 'monospace' }}>{row.sourceMatchId || '—'}</Table.Cell>
                      <Table.Cell>{row.division || '—'}</Table.Cell>
                      <Table.Cell>{row.matchType || '—'}</Table.Cell>
                      <Table.Cell>{formatDate(row.matchDate)}</Table.Cell>
                      <Table.Cell>{row.team1Score ?? '—'}</Table.Cell>
                      <Table.Cell>{row.team2Score ?? '—'}</Table.Cell>
                      <Table.Cell><PlayerSlotCell duprId={row.team1Player1DuprId} match={row.team1Player1Match} /></Table.Cell>
                      <Table.Cell><PlayerSlotCell duprId={row.team1Player2DuprId} match={row.team1Player2Match} /></Table.Cell>
                      <Table.Cell><PlayerSlotCell duprId={row.team2Player1DuprId} match={row.team2Player1Match} /></Table.Cell>
                      <Table.Cell><PlayerSlotCell duprId={row.team2Player2DuprId} match={row.team2Player2Match} /></Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          {row.alreadyProcessed && (
                            <Badge color="green" variant="soft" size="1">Already processed</Badge>
                          )}
                          {row.validationErrors.map((e, i) => (
                            <Flex key={`err-${i}`} align="center" gap="1">
                              <ExclamationTriangleIcon color="var(--red-9)" width={12} height={12} />
                              <Text size="1" color="red">{e}</Text>
                            </Flex>
                          ))}
                          {row.warnings?.map((w, i) => (
                            <Flex key={`warn-${i}`} align="center" gap="1">
                              <ExclamationTriangleIcon color="var(--amber-9)" width={12} height={12} />
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
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card>

        <Flex align="center" gap="3" mt="4">
          <Button onClick={handleConfirm} disabled={!canConfirm} loading={isConfirming}>
            Confirm &amp; Process Matches
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
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>Edit Row {editingRow?.rowNumber}</Dialog.Title>
          {rowSaveError && (
            <Callout.Root color="red" size="1" mb="3">
              <Callout.Text>{rowSaveError}</Callout.Text>
            </Callout.Root>
          )}
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Source Match ID</Text>
              <TextField.Root
                value={editForm.sourceMatchId}
                onChange={(e) => setEditForm((f) => ({ ...f, sourceMatchId: e.target.value }))}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Division</Text>
              <TextField.Root
                value={editForm.division}
                onChange={(e) => setEditForm((f) => ({ ...f, division: e.target.value }))}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Match Type</Text>
              <Select.Root
                value={editForm.matchType || undefined}
                onValueChange={(v) => setEditForm((f) => ({ ...f, matchType: v as 'singles' | 'doubles' }))}
              >
                <Select.Trigger placeholder="Choose…" />
                <Select.Content>
                  <Select.Item value="singles">Singles</Select.Item>
                  <Select.Item value="doubles">Doubles</Select.Item>
                </Select.Content>
              </Select.Root>
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Match Date</Text>
              <TextField.Root
                type="date"
                value={editForm.matchDate}
                onChange={(e) => setEditForm((f) => ({ ...f, matchDate: e.target.value }))}
              />
            </label>
            <Flex gap="3">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 1 Score</Text>
                <TextField.Root
                  type="number"
                  value={editForm.team1Score}
                  onChange={(e) => setEditForm((f) => ({ ...f, team1Score: e.target.value }))}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 2 Score</Text>
                <TextField.Root
                  type="number"
                  value={editForm.team2Score}
                  onChange={(e) => setEditForm((f) => ({ ...f, team2Score: e.target.value }))}
                />
              </Box>
            </Flex>
            <Flex gap="3">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 1 Player 1 DUPR ID</Text>
                <TextField.Root
                  value={editForm.team1Player1DuprId}
                  onChange={(e) => setEditForm((f) => ({ ...f, team1Player1DuprId: e.target.value }))}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 1 Player 2 DUPR ID</Text>
                <TextField.Root
                  value={editForm.team1Player2DuprId}
                  onChange={(e) => setEditForm((f) => ({ ...f, team1Player2DuprId: e.target.value }))}
                  placeholder="Leave blank for singles"
                />
              </Box>
            </Flex>
            <Flex gap="3">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 2 Player 1 DUPR ID</Text>
                <TextField.Root
                  value={editForm.team2Player1DuprId}
                  onChange={(e) => setEditForm((f) => ({ ...f, team2Player1DuprId: e.target.value }))}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Team 2 Player 2 DUPR ID</Text>
                <TextField.Root
                  value={editForm.team2Player2DuprId}
                  onChange={(e) => setEditForm((f) => ({ ...f, team2Player2DuprId: e.target.value }))}
                  placeholder="Leave blank for singles"
                />
              </Box>
            </Flex>
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