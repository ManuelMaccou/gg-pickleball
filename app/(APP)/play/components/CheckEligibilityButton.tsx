'use client';

// Destination: components/sections/CheckEligibilityButton.tsx
//
// Compact button + result messaging, meant for the hero's top-right slot
// (same position the old hidden Connect DUPR/Refresh button used to
// occupy). Uses useCheckEligibility for the actual logic.

import { Button, Callout, Flex, Spinner } from '@radix-ui/themes';
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { CalendarCheck } from 'lucide-react';
import { FrontendUser } from '@/app/types/frontendTypes';
import { useCheckEligibility } from '@/lib/hooks/useCheckEligibility';

const LIME = '#a3e635';

interface CheckEligibilityButtonProps {
  dbUser: FrontendUser | null;
  onInitiateDuprLogin: () => void;
  onRewardsMayHaveChanged?: () => void;
}

export function CheckEligibilityButton({
  dbUser,
  onInitiateDuprLogin,
  onRewardsMayHaveChanged,
}: CheckEligibilityButtonProps) {
  const { result, buttonLabel, handleCheckEligibility } = useCheckEligibility(
    dbUser,
    onInitiateDuprLogin,
    onRewardsMayHaveChanged
  );

  return (
    <Flex direction="column" gap="2" align={{ initial: 'stretch', sm: 'end' }} style={{ flexShrink: 0 }}>
      <Button
        size="3"
        radius="full"
        onClick={handleCheckEligibility}
        disabled={result.status === 'loading'}
        style={{
          backgroundColor: LIME, color: '#0a0a0a', fontWeight: 'bold',
          cursor: 'pointer', padding: '0 24px', height: 48,
          boxShadow: '0 0 24px rgba(163,230,53,0.25)',
        }}
      >
        {result.status === 'loading'
          ? <Spinner size="1" style={{ marginRight: 8 }} />
          : <CalendarCheck size={16} style={{ marginRight: 8 }} />}
        {buttonLabel}
      </Button>

      {result.status === 'success' && (
        <Callout.Root color={result.matchesProcessed > 0 ? 'green' : 'gray'} size="1" style={{ maxWidth: 340 }}>
          <Callout.Icon>
            {result.matchesProcessed > 0 ? <CheckCircledIcon /> : <InfoCircledIcon />}
          </Callout.Icon>
          <Callout.Text style={{color: 'white'}}>
            {result.matchesProcessed > 0
              ? `Found ${result.matchesProcessed} match${result.matchesProcessed === 1 ? '' : 'es'} — check your rewards below.`
              : 'Your rewards are up to date.'}
          </Callout.Text>
        </Callout.Root>
      )}

      {/* Deliberately generic — never states or implies a specific age
          determination back to the person looking at this screen. */}
      {result.status === 'blocked' && (
        <Callout.Root color="amber" size="1" style={{ maxWidth: 340 }}>
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>We weren't able to verify eligibility for this account.</Callout.Text>
        </Callout.Root>
      )}

      {result.status === 'error' && (
        <Callout.Root color="red" size="1" style={{ maxWidth: 340 }}>
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{result.message}</Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );
}

export default CheckEligibilityButton;