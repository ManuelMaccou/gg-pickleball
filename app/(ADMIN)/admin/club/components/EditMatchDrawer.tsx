'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, Button, Flex, Text, TextField, IconButton, Box, Callout,
} from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { DuprPlayerResult, DuprPlayerSearch } from '../../components/DuprPlayerSearch';

interface TeamRow {
  player1: DuprPlayerResult | null;
  player2: DuprPlayerResult | null;
  game1: number | ''; game2: number | ''; game3: number | '';
  game4: number | ''; game5: number | '';
}

interface MatchToEdit {
  _id: string;
  matchDate: string;
  teamA: {
    player1: { name: string; duprId: string };
    player2: { name: string; duprId: string };
    game1: number; game2: number; game3: number; game4: number; game5: number;
  };
  teamB: {
    player1: { name: string; duprId: string };
    player2: { name: string; duprId: string };
    game1: number; game2: number; game3: number; game4: number; game5: number;
  };
  location?: string;
}

// Map a stored player (name + duprId) to DuprPlayerResult so DuprPlayerSearch
// shows it in "selected" state without requiring the admin to re-search.
const storedPlayerToResult = (p: { name: string; duprId: string }): DuprPlayerResult => ({
  duprId: p.duprId,
  fullName: p.name,
  doublesRating: null, // Not stored on the match — shown as NR, acceptable for edit context.
});

const teamForSubmit = (t: TeamRow) => ({
  player1: { name: t.player1!.fullName, duprId: t.player1!.duprId },
  player2: { name: t.player2!.fullName, duprId: t.player2!.duprId },
  game1: Number(t.game1) || 0,
  game2: Number(t.game2) || 0,
  game3: Number(t.game3) || 0,
  game4: Number(t.game4) || 0,
  game5: Number(t.game5) || 0,
});

export function EditMatchDrawer({
  match, open, onOpenChange, onUpdated,
}: {
  match: MatchToEdit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const [matchDate, setMatchDate] = useState('');
  const [teamA, setTeamA] = useState<TeamRow | null>(null);
  const [teamB, setTeamB] = useState<TeamRow | null>(null);
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill form when match changes — map stored players into DuprPlayerResult
  // so DuprPlayerSearch shows them in selected state immediately.
  useEffect(() => {
    if (match) {
      const d = new Date(match.matchDate);
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      setMatchDate(dateStr);
      setTeamA({
        player1: storedPlayerToResult(match.teamA.player1),
        player2: storedPlayerToResult(match.teamA.player2),
        game1: match.teamA.game1 ?? '',
        game2: match.teamA.game2 ?? '',
        game3: match.teamA.game3 ?? '',
        game4: match.teamA.game4 ?? '',
        game5: match.teamA.game5 ?? '',
      });
      setTeamB({
        player1: storedPlayerToResult(match.teamB.player1),
        player2: storedPlayerToResult(match.teamB.player2),
        game1: match.teamB.game1 ?? '',
        game2: match.teamB.game2 ?? '',
        game3: match.teamB.game3 ?? '',
        game4: match.teamB.game4 ?? '',
        game5: match.teamB.game5 ?? '',
      });
      setLocation(match.location ?? '');
      setError(null);
      setSuccess(false);
    }
  }, [match]);

  const updatePlayer = (team: 'A' | 'B', slot: 'player1' | 'player2', player: DuprPlayerResult | null) => {
    const setter = team === 'A' ? setTeamA : setTeamB;
    setter((prev) => prev ? { ...prev, [slot]: player } : prev);
  };

  const updateTeamScores = (team: 'A' | 'B', patch: Partial<TeamRow>) => {
    const setter = team === 'A' ? setTeamA : setTeamB;
    setter((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const handleSubmit = async () => {
    if (!match || !teamA || !teamB) return;
    setError(null);
    setSuccess(false);

    if (!matchDate) return setError('Match date is required.');
    for (const t of [teamA, teamB]) {
      if (!t.player1 || !t.player2) {
        return setError('Every player slot must have a player selected.');
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/club/matches/${match._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchDate,
          teamA: teamForSubmit(teamA),
          teamB: teamForSubmit(teamB),
          location: location || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');

      setSuccess(true);
      onUpdated();
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeam = (teamKey: 'A' | 'B', label: string) => {
    const t = teamKey === 'A' ? teamA : teamB;
    if (!t) return null;

    return (
      <Box style={{ flex: 1, border: '1px solid var(--gray-4)', borderRadius: 8, padding: 12 }}>
        <Text size="2" weight="bold" mb="3" style={{ display: 'block' }}>{label}</Text>

        {(['player1', 'player2'] as const).map((slot, i) => (
          <Box key={slot} mb="3">
            <Text size="1" color="gray" mb="1" style={{ display: 'block' }}>
              Player {i + 1}
            </Text>
            <DuprPlayerSearch
              selected={t[slot]}
              onSelect={(player) => updatePlayer(teamKey, slot, player)}
              placeholder={`Search player ${i + 1} by name…`}
            />
          </Box>
        ))}

        <Text size="1" color="gray" mb="1" style={{ display: 'block' }}>Game scores</Text>
        <Flex gap="2">
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const key = `game${n}` as keyof TeamRow;
            return (
              <Box key={n} style={{ width: 56 }}>
                <Text size="1" color="gray">G{n}</Text>
                <TextField.Root
                  type="number"
                  value={t[key] as number | ''}
                  onChange={(e) =>
                    updateTeamScores(teamKey, {
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 1100 }}>
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>Edit match</Dialog.Title>
          <IconButton variant="ghost" color="gray" onClick={() => onOpenChange(false)}>
            <Cross2Icon />
          </IconButton>
        </Flex>
        <Dialog.Description size="2" color="gray" mb="4">
          Changes will be sent to DUPR. The local record updates only after DUPR confirms.
        </Dialog.Description>

        {error && (
          <Callout.Root color="red" mb="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}
        {success && (
          <Callout.Root color="green" mb="3">
            <Callout.Text>Match updated successfully.</Callout.Text>
          </Callout.Root>
        )}

        <Box style={{ border: '1px solid var(--gray-4)', borderRadius: 8, padding: 12 }}>
          <Flex gap="3" mb="3" wrap="wrap">
            <Box style={{ flex: '1 1 180px' }}>
              <Text size="1" color="gray">Date</Text>
              <TextField.Root
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
              />
            </Box>
            <Box style={{ flex: '1 1 180px' }}>
              <Text size="1" color="gray">Location (optional)</Text>
              <TextField.Root
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Box>
          </Flex>

          <Flex gap="3" wrap="wrap">
            {renderTeam('A', 'Team A')}
            {renderTeam('B', 'Team B')}
          </Flex>
        </Box>

        <Flex gap="3" justify="end" mt="5">
          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Updating…' : 'Update Match'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}