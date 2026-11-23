'use client';

// Destination: components/sections/CheckEligibilityPanel.tsx
//
// The signature element of the reorganized /play layout — a tall, visually
// distinct panel rather than a button tucked in a corner, since this is
// the single most valuable, novel action on the page (self-serve reward
// discovery for anyone whose matches were processed before they had an
// account). Reuses useCheckEligibility for all the actual logic —
// CheckEligibilityButton.tsx (compact version) still exists if a smaller
// footprint is ever needed elsewhere.

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Callout, Flex, Heading, Spinner, Text } from '@radix-ui/themes';
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { CalendarCheck } from 'lucide-react';
import { FrontendUser } from '@/app/types/frontendTypes';
import { useCheckEligibility } from '@/lib/hooks/useCheckEligibility';

const LIME = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.1)';
const LIME_BORDER = 'rgba(163,230,53,0.25)';
const TEXT_MUTED = 'rgba(255,255,255,0.5)';

interface CheckEligibilityPanelProps {
  dbUser: FrontendUser | null;
  onInitiateDuprLogin: () => void;
  onRewardsMayHaveChanged?: () => void;
  /** Bumped by the page right after DUPR is connected — runs the check
   *  automatically so players don't have to know to click it. */
  autoCheckKey?: number;
}

// Win milestones that currently have a reward, e.g. [5, 10, 15]. Read from
// the same endpoint the rewards wallet uses; achievement names look like
// "5-dupr-matches-won".
function useWinMilestones(): number[] {
  const [milestones, setMilestones] = useState<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/source-reward-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const wins = new Set<number>();
        for (const item of data.rewards ?? []) {
          const match = String(item?.achievement?.name ?? '').match(/^(\d+)-dupr-matches-won$/);
          if (match) wins.add(parseInt(match[1], 10));
        }
        setMilestones([...wins].sort((a, b) => a - b));
      })
      .catch(() => { /* progress line is optional — skip it on failure */ });
    return () => { cancelled = true; };
  }, []);
  return milestones;
}

function progressMessage(wins: number, milestones: number[]): string | null {
  if (milestones.length === 0) return null;
  const next = milestones.find((m) => m > wins);
  if (next === undefined) return null;
  const more = next - wins;
  const moreText = `${more} more win${more === 1 ? '' : 's'}`;
  if (wins < milestones[0]) {
    return `${wins} win${wins === 1 ? '' : 's'} so far — ${moreText} to unlock your first reward.`;
  }
  return `${moreText} to your next reward.`;
}

export function CheckEligibilityPanel({
  dbUser,
  onInitiateDuprLogin,
  onRewardsMayHaveChanged,
  autoCheckKey = 0,
}: CheckEligibilityPanelProps) {
  const { result, buttonLabel, handleCheckEligibility } = useCheckEligibility(
    dbUser,
    onInitiateDuprLogin,
    onRewardsMayHaveChanged
  );

  const milestones = useWinMilestones();
  const wins = Object.values(dbUser?.stats ?? {}).reduce((sum, s) => sum + (s?.wins ?? 0), 0);
  const progress = dbUser?.dupr?.id ? progressMessage(wins, milestones) : null;

  // Auto-run once per DUPR connect. The page sets the connected user and
  // bumps the key in the same update, so dbUser already has the token here.
  const lastAutoCheck = useRef(0);
  useEffect(() => {
    if (autoCheckKey === 0 || autoCheckKey === lastAutoCheck.current) return;
    if (!dbUser?.dupr?.userToken || result.status === 'loading') return;
    lastAutoCheck.current = autoCheckKey;
    handleCheckEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckKey, dbUser]);

  return (
    <Flex
      direction="column"
      justify="between"
      height="100%"
      style={{
        borderRadius: 24,
        background: 'linear-gradient(160deg, rgba(163,230,53,0.09) 0%, #111 55%)',
        border: `0.5px solid ${LIME_BORDER}`,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 240,
      }}
    >
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 180, height: 180,
        background: 'radial-gradient(circle at center, rgba(163,230,53,0.25) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      <Box style={{ position: 'relative', zIndex: 1 }}>
        <Flex align="center" justify="center" mb="4" style={{
          width: 44, height: 44, borderRadius: 12,
          background: LIME_DIM, border: `0.5px solid ${LIME_BORDER}`,
        }}>
          <CalendarCheck size={20} style={{ color: LIME }} />
        </Flex>
        <Heading size="5" style={{ color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8 }}>
          Played in a tournament?
        </Heading>
        <Text size="2" style={{ color: TEXT_MUTED, lineHeight: 1.5 }}>
          Check your match history from all participating events. Rewards unlock instantly if you qualify.
        </Text>
      </Box>

      <Flex direction="column" gap="2" style={{ position: 'relative', zIndex: 1, marginTop: 20 }}>
        <Button
          size="3"
          radius="full"
          onClick={handleCheckEligibility}
          disabled={result.status === 'loading'}
          style={{
            backgroundColor: LIME, color: '#0a0a0a', fontWeight: 'bold',
            cursor: 'pointer', height: 48, width: '100%',
            boxShadow: '0 0 24px rgba(163,230,53,0.25)',
          }}
        >
          {result.status === 'loading' && <Spinner size="1" style={{ marginRight: 8 }} />}
          {buttonLabel}
        </Button>

        {/* Matches credited (some may have failed — say so, they can retry). */}
        {result.status === 'success' && result.matchesProcessed > 0 && (
          <Callout.Root color="green" size="1">
            <Callout.Icon><CheckCircledIcon /></Callout.Icon>
            <Callout.Text style={{color: 'white'}}>
              {`Found ${result.matchesProcessed} match${result.matchesProcessed === 1 ? '' : 'es'} — check your rewards below.`}
              {result.matchesFailed > 0 &&
                ` ${result.matchesFailed} couldn't be updated — please try again in a few minutes.`}
              {progress && ` ${progress}`}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Matches found but none could be processed — never "up to date". */}
        {result.status === 'success' && result.matchesProcessed === 0 && result.matchesFailed > 0 && (
          <Callout.Root color="red" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              {`We found ${result.matchesFailed} match${result.matchesFailed === 1 ? '' : 'es'} but couldn't update ${result.matchesFailed === 1 ? 'it' : 'them'}. Please try again in a few minutes.`}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Nothing new to credit. */}
        {result.status === 'success' && result.matchesFound === 0 && (
          <Callout.Root color="blue" size="1">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text style={{color: 'white'}}>
              {progress ? `Your rewards are up to date. ${progress}` : 'Your rewards are up to date.'}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Deliberately generic — never states or implies a specific age
            determination back to the person looking at this screen. */}
        {result.status === 'blocked' && (
          <Callout.Root color="orange" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>We weren't able to verify eligibility for this account. Please try again later.</Callout.Text>
          </Callout.Root>
        )}

        {result.status === 'error' && (
          <Callout.Root color="red" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>{result.message}</Callout.Text>
          </Callout.Root>
        )}
      </Flex>
    </Flex>
  );
}

export default CheckEligibilityPanel;