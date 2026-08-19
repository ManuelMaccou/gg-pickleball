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
}

export function CheckEligibilityPanel({
  dbUser,
  onInitiateDuprLogin,
  onRewardsMayHaveChanged,
}: CheckEligibilityPanelProps) {
  const { result, buttonLabel, handleCheckEligibility } = useCheckEligibility(
    dbUser,
    onInitiateDuprLogin,
    onRewardsMayHaveChanged
  );

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

        {result.status === 'success' && (
          <Callout.Root color={result.matchesProcessed > 0 ? 'green' : 'blue'} size="1">
            <Callout.Icon>
              {result.matchesProcessed > 0 ? <CheckCircledIcon /> : <InfoCircledIcon />}
            </Callout.Icon>
            <Callout.Text style={{color: 'white'}}>
              {result.matchesProcessed > 0
                ? `Found ${result.matchesProcessed} match${result.matchesProcessed === 1 ? '' : 'es'} — check your rewards below.`
                : 'No new matches found in the last 6 months.'}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Deliberately generic — never states or implies a specific age
            determination back to the person looking at this screen. */}
        {result.status === 'blocked' && (
          <Callout.Root color="amber" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>We weren't able to verify eligibility for this account right now.</Callout.Text>
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