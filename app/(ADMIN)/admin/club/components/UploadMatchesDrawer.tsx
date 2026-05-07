'use client';

import { useState } from 'react';
import {
  Dialog, Button, Flex, Text, TextField, IconButton, Box, Callout,
  Badge,
} from '@radix-ui/themes';
import { PlusIcon, TrashIcon, Cross2Icon } from '@radix-ui/react-icons';
import { DuprPlayerResult, DuprPlayerSearch } from '../../components/DuprPlayerSearch';

export interface PlayerRow {
  name: string;
  duprId: string;
}

interface TeamRow {
  player1: DuprPlayerResult | null;
  player2: DuprPlayerResult | null;
  game1: number | ''; game2: number | ''; game3: number | '';
  game4: number | ''; game5: number | '';
}

interface MatchRow {
  id: string;
  matchDate: string;
  teamA: TeamRow;
  teamB: TeamRow;
  location?: string;
  succeeded?: boolean;
}

const blankTeam = (): TeamRow => ({
  player1: null,
  player2: null,
  game1: '', game2: '', game3: '', game4: '', game5: '',
});

const blankMatch = (): MatchRow => ({
  id: Math.random().toString(36).slice(2),
  matchDate: new Date().toISOString().slice(0, 10),
  teamA: blankTeam(),
  teamB: blankTeam(),
});

// Coerce game scores to numbers (empty -> 0).
const teamForSubmit = (t: TeamRow) => ({
  player1: { name: t.player1!.fullName, duprId: t.player1!.duprId },
  player2: { name: t.player2!.fullName, duprId: t.player2!.duprId },
  game1: Number(t.game1) || 0,
  game2: Number(t.game2) || 0,
  game3: Number(t.game3) || 0,
  game4: Number(t.game4) || 0,
  game5: Number(t.game5) || 0,
});

export function UploadMatchesDrawer({
  clubId, eventId, open, onOpenChange, onSubmitted,
}: {
  clubId: string;
  eventId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const [rows, setRows] = useState<MatchRow[]>([blankMatch()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ ok: boolean; error?: string }[] | null>(null);

  const updateRow = (id: string, patch: Partial<MatchRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateTeam = (id: string, team: 'teamA' | 'teamB', patch: Partial<TeamRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [team]: { ...r[team], ...patch } } : r)));

  const addRow = () => setRows((rs) => [...rs, blankMatch()]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const handleSubmit = async () => {
    setError(null);
    setResults(null);

    const pendingRows = rows.filter((r) => !r.succeeded);
    if (pendingRows.length === 0) return;

    // Validation
    for (const r of pendingRows) {
      if (!r.matchDate) return setError('Every match needs a date.');

      for (const team of [r.teamA, r.teamB]) {
        if (!team.player1 || !team.player2) {
          return setError('Every player slot must have a player selected from search.');
        }
      }

      if (r.teamA.game1 === '' || r.teamB.game1 === '') {
        return setError('Both teams need a score for at least Game 1.');
      }

      for (const gameNum of [2, 3, 4, 5] as const) {
        const key = `game${gameNum}` as const;
        const aHasScore = r.teamA[key] !== '';
        const bHasScore = r.teamB[key] !== '';
        if (aHasScore !== bHasScore) {
          return setError(`Game ${gameNum}: if one team has a score, both teams need a score.`);
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/club/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          eventId,
          matches: pendingRows.map((r) => ({
            matchDate: r.matchDate,
            teamA: teamForSubmit(r.teamA),
            teamB: teamForSubmit(r.teamB),
            location: r.location,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setResults(data.results);

      const anyFailed = data.results.some((x: { ok: boolean }) => !x.ok);
      if (!anyFailed) {
        onSubmitted();
        onOpenChange(false);
        setRows([blankMatch()]);
      } else {
        let resultIndex = 0;
        const updatedRows = rows.map((row) => {
          if (row.succeeded) return row;
          const result = data.results[resultIndex];
          resultIndex++;
          return { ...row, succeeded: result?.ok === true };
        });
        setRows(updatedRows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeam = (row: MatchRow, team: 'teamA' | 'teamB', label: string) => {
    const t = row[team];
    const isLocked = !!row.succeeded;
    return (
      <Box
        style={{
          flex: 1,
          border: '1px solid var(--gray-4)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <Text size="2" weight="bold" mb="3" style={{ display: 'block' }}>{label}</Text>

        {(['player1', 'player2'] as const).map((slot, i) => (
          <Box key={slot} mb="3">
            <Text size="1" color="gray" mb="1" style={{ display: 'block' }}>
              Player {i + 1}
            </Text>
            <DuprPlayerSearch
              selected={t[slot]}
              onSelect={(player) => updateTeam(row.id, team, { [slot]: player })}
              clubId={clubId}
              disabled={isLocked}
              placeholder={`Search player ${i + 1} by name…`}
            />
          </Box>
        ))}

        <Text size="1" color="gray" mb="1" style={{ display: 'block' }}>Game scores</Text>
        <Flex gap="2">
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const key = `game${n}` as const;
            return (
              <Box key={n} style={{ width: 56 }}>
                <Text size="1" color="gray">G{n}</Text>
                <TextField.Root
                  type="number"
                  value={t[key]}
                  disabled={isLocked}
                  onChange={(e) =>
                    updateTeam(row.id, team, {
                      [key]: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </Box>
            );
          })}
        </Flex>
      </Box>
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          if (rows.some((r) => r.succeeded)) onSubmitted();
          setRows([blankMatch()]);
          setResults(null);
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <Dialog.Content style={{ maxWidth: 1100 }}>
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>Upload matches to DUPR</Dialog.Title>
          <IconButton variant="ghost" color="gray" onClick={() => onOpenChange(false)}>
            <Cross2Icon />
          </IconButton>
        </Flex>
        <Dialog.Description size="2" color="gray" mb="4">
          Search for each player by name to select them from DUPR. Add scores, then submit.
          Tell your community to sync afterwards to see results in their accounts.
        </Dialog.Description>

        {error && (
          <Callout.Root color="red" mb="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}
        {results && (
          <Callout.Root color={results.every((r) => r.ok) ? 'green' : 'red'} mb="3">
            <Callout.Text>
              {results.filter((r) => r.ok).length} of {results.length} matches submitted.
            </Callout.Text>
            {results
              .filter((r) => !r.ok)
              .map((r, i) => (
                <Callout.Text key={i} size="1" mt="1">
                  Match {results.indexOf(r) + 1} failed: {r.error ?? 'Unknown error'}
                </Callout.Text>
              ))}
          </Callout.Root>
        )}

        <Flex direction="column" gap="4">
          {rows.map((row, i) => (
            <Box
              key={row.id}
              style={{
                border: '1px solid var(--gray-4)',
                borderRadius: 8,
                padding: 12,
                opacity: row.succeeded ? 0.5 : 1,
                pointerEvents: row.succeeded ? 'none' : 'auto',
              }}
            >
              <Flex justify="between" align="center" mb="3">
                <Flex align="center" gap="2">
                  <Text size="2" weight="bold">Match {i + 1}</Text>
                  {row.succeeded && (
                    <Badge color="green" radius="full" size="1">Submitted</Badge>
                  )}
                </Flex>
                {rows.length > 1 && (
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={() => removeRow(row.id)}
                  >
                    <TrashIcon />
                  </IconButton>
                )}
              </Flex>

              <Flex gap="3" mb="3" wrap="wrap">
                <Box style={{ flex: '1 1 180px' }}>
                  <Text size="1" color="gray">Date</Text>
                  <TextField.Root
                    type="date"
                    value={row.matchDate}
                    onChange={(e) => updateRow(row.id, { matchDate: e.target.value })}
                  />
                </Box>
                <Box style={{ flex: '1 1 180px' }}>
                  <Text size="1" color="gray">Location (optional)</Text>
                  <TextField.Root
                    value={row.location ?? ''}
                    onChange={(e) => updateRow(row.id, { location: e.target.value })}
                  />
                </Box>
              </Flex>

              <Flex gap="3" wrap="wrap">
                {renderTeam(row, 'teamA', 'Team A')}
                {renderTeam(row, 'teamB', 'Team B')}
              </Flex>
            </Box>
          ))}

          <Button variant="soft" onClick={addRow}>
            <PlusIcon /> Add another match
          </Button>
        </Flex>

        <Flex gap="3" justify="end" mt="5">
          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? 'Submitting…'
              : `Submit ${rows.filter((r) => !r.succeeded).length} to DUPR`}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}