'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, IconButton, Button, Callout, Box } from '@radix-ui/themes';
import { Cross1Icon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
import { FrontendUser } from '@/app/types/frontendTypes';
import { parseDuprRating } from '@/lib/services/dupr/parseDuprRating';

interface DuprConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called after the user closes the modal, with the updated user (if they
  // connected during this session). Entitlements are force-refreshed before
  // this fires so the parent receives the most current data — including any
  // DUPR+ upgrade the user completed inside the iframe.
  onConnected?: (updatedUser: FrontendUser) => void;
}

export function DuprConnectModal({
  open,
  onOpenChange,
  onConnected,
}: DuprConnectModalProps) {
  const { user } = useUserContext();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track whether a successful connect happened during this modal session.
  // If yes, force-refresh entitlements when the modal closes — covers the
  // case where the user upgraded to DUPR+ inside the iframe after the
  // initial entitlement check ran on connect.
  const connectedInSessionRef = useRef(false);
  const lastConnectedUserRef = useRef<FrontendUser | null>(null);

  const duprClientId = process.env.NEXT_PUBLIC_DUPR_CLIENT_ID;
  const duprConfig = useMemo(() => {
    const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
    const baseUrl = appEnv === 'production' ? 'https://dashboard.dupr.com' : 'https://uat.dupr.gg';
    if (!duprClientId) return { loginUrl: '', origin: '' };
    return { loginUrl: `${baseUrl}/login-external-app/${btoa(duprClientId)}`, origin: baseUrl };
  }, [duprClientId]);

  // Reset internal state when modal opens so re-opening starts fresh.
  useEffect(() => {
    if (open) {
      setError(null);
      setSaving(false);
      connectedInSessionRef.current = false;
      lastConnectedUserRef.current = null;
    }
  }, [open]);

  // Wraps onOpenChange — when closing after a successful connect, force-refresh
  // entitlements before notifying the parent so the parent receives the
  // most up-to-date user (including any DUPR+ upgrade done in the iframe).
  const handleClose = async () => {
    if (!connectedInSessionRef.current) {
      onOpenChange(false);
      return;
    }

    try {
      const res = await fetch('/api/dupr/refresh-entitlements', { method: 'POST' });
      if (res.ok) {
        const refreshedUser: FrontendUser = await res.json();
        onConnected?.(refreshedUser);
      } else {
        // Refresh failed — fall back to the user we received from the connect
        // PATCH so the parent at least sees a connected state.
        if (lastConnectedUserRef.current) onConnected?.(lastConnectedUserRef.current);
      }
    } catch (err) {
      console.error('[DuprConnectModal] Failed to refresh entitlements:', err);
      if (lastConnectedUserRef.current) onConnected?.(lastConnectedUserRef.current);
    } finally {
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (!open || !duprConfig.origin) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== duprConfig.origin) return;
      const data = event.data;
      if (!data?.userToken || !data?.duprId) return;

      setSaving(true);
      setError(null);

      try {
        const response = await fetch('/api/user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            findBy: 'userId',
            userId: user?.id,
            dupr: {
              id: data.duprId,
              userToken: data.userToken,
              refreshToken: data.refreshToken,
              rating: parseDuprRating(data.stats?.doubles),
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save DUPR info.');
        }

        const updatedUser: FrontendUser = await response.json();
        connectedInSessionRef.current = true;
        lastConnectedUserRef.current = updatedUser;

        // Don't call onConnected here — wait until close so we can deliver
        // the freshest entitlements (in case user upgrades in the iframe).
      } catch (err: unknown) {
        let message = 'An unexpected error occurred while connecting to DUPR.';
        if (err instanceof Error) message = err.message;
        else if (typeof err === 'string') message = err;
        setError(message);
      } finally {
        setSaving(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, user, duprConfig]);

  if (!open) return null;

  if (!duprConfig.loginUrl || !duprConfig.origin) {
    return (
      <Flex style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Box style={{
          backgroundColor: 'white', borderRadius: '16px',
          padding: '24px', maxWidth: '400px', width: '90%',
        }}>
          <Callout.Root color="red" mb="3">
            <Callout.Text>DUPR integration is not configured.</Callout.Text>
          </Callout.Root>
          <Flex justify="end">
            <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </Flex>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
      justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)',
    }}>
      {/* Iframe — always mounted while modal is open. Only hidden on error
          so the error overlay is readable. Never hidden during saving so
          DUPR's post-auth screens stay visible immediately after connect. */}
      <div style={{
        width: '90%', maxWidth: '500px', height: '80%', backgroundColor: 'white',
        position: 'relative', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        visibility: error ? 'hidden' : 'visible',
      }}>
        <IconButton
          variant="solid" color="gray" highContrast radius="full"
          onClick={handleClose}
          style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 20 }}
        >
          <Cross1Icon width="20" height="20" />
        </IconButton>
        <iframe
          src={duprConfig.loginUrl}
          title="DUPR Login"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
        />
      </div>

      {/* Error overlay — iframe stays mounted underneath so user can retry */}
      {error && (
        <Box style={{
          position: 'absolute',
          backgroundColor: 'white', borderRadius: '16px',
          padding: '24px', maxWidth: '400px', width: '90%',
        }}>
          <Callout.Root color="red" mb="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
          <Flex gap="2" justify="end">
            <Button variant="soft" color="gray" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={() => setError(null)}>Try Again</Button>
          </Flex>
        </Box>
      )}
    </Flex>
  );
}