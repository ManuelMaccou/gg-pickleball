'use client';

import { useEffect, useState, Suspense } from 'react';
import {
  Flex, Heading, Text, TextField, Button, Callout,
  Spinner, Box, Card, Dialog,
} from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon, LockClosedIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandPageShell } from '../../components/BrandPageShell';

function ConnectShopifyContent() {
  const { user } = useUserContext();
  const { isLoading: isAuthLoading } = useAuth0User();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shopDomain, setShopDomain] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [location, setLocation] = useState<IClient | null>(null);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [fullyConnectedToShopify, setFullyConnectedToShopify] = useState(false);
  const [hasConfiguredRewards, setHasConfiguredRewards] = useState(false);
  const [changeWarningOpen, setChangeWarningOpen] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push(`/auth/login?returnTo=${encodeURIComponent('/admin/brand/connect-shopify')}`);
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch(`/api/admin?userId=${user.id}`);
        if (res.status === 204 || res.status === 403) { router.replace('/error?reason=no_admin_permissions'); return; }
        if (!res.ok) { router.replace('/error?reason=unknown'); return; }
        const data = await res.json();
        setAdminPermission(data.admin?.permission ?? null);
        setLocation(data.location ?? null);
        setHasConfiguredRewards(!!data.location?.hasConfiguredRewards);
        const shopDomainFromDB = data.location?.shopify?.shopDomain;
        const accessTokenFromDB = data.location?.shopify?.accessToken;
        if (shopDomainFromDB) {
          setConnectedShop(shopDomainFromDB);
          setShopDomain(shopDomainFromDB);
        }
        if (shopDomainFromDB && accessTokenFromDB) setFullyConnectedToShopify(true);
      } catch (e) {
        console.error('[ConnectShopify] Failed to check admin permissions:', e);
        router.replace('/error?reason=unknown');
      } finally {
        setIsAdminChecking(false);
      }
    };
    checkAdmin();
  }, [user, isAuthLoading, router]);

  const handleInstall = () => {
    setInstallError(null);
    setIsRedirecting(true);
    let cleanDomain = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain.includes('.')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    } else if (!cleanDomain.endsWith('.myshopify.com')) {
      setInstallError('Please enter your .myshopify.com domain (e.g. my-store.myshopify.com)');
      setIsRedirecting(false);
      return;
    }
    window.location.href = `/api/shopify/install?shop=${cleanDomain}`;
  };

  if (isAuthLoading || isAdminChecking) {
    return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  }

  // ── CONNECTED STATE ────────────────────────────────────────────────────────
  if (fullyConnectedToShopify && !searchParams.get('reconnect')) {
    return (
      <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
        <Flex direction="column" align="center" gap="5" pt="9">
          <CheckCircledIcon width={52} height={52} color="var(--green-9)" />
          <Flex direction="column" align="center" gap="2">
            <Heading size="6" align="center">Shopify Connected</Heading>
            <Text align="center" color="gray" size="3">
              <Text weight="bold">{connectedShop}</Text> is successfully connected.
              Reward codes earned by players will automatically sync to your Shopify discounts.
            </Text>
          </Flex>

          <Flex gap="3" mt="2" direction="column" align="center">
            <Button onClick={() => router.push('/admin/brand')}>
              Go to Dashboard
            </Button>

            {hasConfiguredRewards ? (
              // Domain locked — rewards exist, can't change stores
              <Flex
                align="center"
                gap="2"
                px="3"
                py="2"
                style={{
                  backgroundColor: 'var(--gray-2)',
                  border: '1px solid var(--gray-5)',
                  borderRadius: 8,
                  maxWidth: 420,
                }}
              >
                <LockClosedIcon color="var(--gray-9)" style={{ flexShrink: 0 }} />
                <Text size="2" color="gray" align="center">
                  Your connected store is locked because you have active rewards configured.
                  To change stores, contact support.
                </Text>
              </Flex>
            ) : (
              // No rewards — allow change but warn first
              <Button
                variant="ghost"
                color="gray"
                onClick={() => setChangeWarningOpen(true)}
              >
                Reconnect / Change Store
              </Button>
            )}
          </Flex>
        </Flex>

        {/* Warning dialog — shown before store change when no rewards */}
        <Dialog.Root open={changeWarningOpen} onOpenChange={setChangeWarningOpen}>
          <Dialog.Content maxWidth="460px">
            <Flex align="center" gap="2" mb="3">
              <ExclamationTriangleIcon color="var(--amber-9)" width={20} height={20} />
              <Dialog.Title>Change connected store?</Dialog.Title>
            </Flex>
            <Dialog.Description size="2" color="gray" mb="4">
              You're about to disconnect <Text weight="bold">{connectedShop}</Text> and
              connect a different Shopify store. Your current Shopify credentials will be
              replaced. If you have promo codes or discount codes configured on your current
              store, they will no longer work.
            </Dialog.Description>
            <Text size="2" color="gray" mb="5" style={{ display: 'block' }}>
              Only proceed if you're intentionally switching to a different store.
            </Text>
            <Flex gap="3" justify="end">
              <Button variant="soft" color="gray" onClick={() => setChangeWarningOpen(false)}>
                Cancel
              </Button>
              <Button
                color="amber"
                onClick={() => {
                  setChangeWarningOpen(false);
                  router.push('/admin/brand/connect-shopify?reconnect=1');
                }}
              >
                Continue and change store
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

      </BrandPageShell>
    );
  }

  // ── CONNECT / RECONNECT FORM ───────────────────────────────────────────────
  const isReconnecting = !!searchParams.get('reconnect');

  return (
    <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
      <Box pt="6">
        <Flex direction="column" gap="2" mb="6">
          <Heading size="6">{isReconnecting ? 'Change Shopify Store' : 'Connect Shopify'}</Heading>
          <Text color="gray" size="3">
            {isReconnecting
              ? 'Enter the domain of the new store you want to connect. Your existing store credentials will be replaced.'
              : 'Enter your Shopify store domain to enable automated reward discounts for players.'}
          </Text>
        </Flex>

        {isReconnecting && (
          <Callout.Root color="amber" mb="4">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              You are replacing an existing Shopify connection. Make sure you want to proceed.
            </Callout.Text>
          </Callout.Root>
        )}

        <Card size="3">
          <Flex direction="column" gap="5">
            {installError && (
              <Callout.Root color="red">
                <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                <Callout.Text>{installError}</Callout.Text>
              </Callout.Root>
            )}

            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">Shop Domain</Text>
              <TextField.Root
                placeholder="my-store.myshopify.com"
                size="3"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isRedirecting && shopDomain && handleInstall()}
              >
                <TextField.Slot>https://</TextField.Slot>
              </TextField.Root>
              <Text size="1" color="gray">
                Only .myshopify.com domains are supported. Custom domains are not yet supported.
              </Text>
            </Flex>

            <Button
              size="3"
              color={isReconnecting ? 'amber' : undefined}
              onClick={handleInstall}
              disabled={isRedirecting || !shopDomain.trim()}
            >
              {isRedirecting
                ? <><Spinner /> Redirecting to Shopify…</>
                : isReconnecting
                ? 'Connect New Store'
                : 'Install App'}
            </Button>

            <Text size="1" align="center" color="gray">
              You'll be redirected to Shopify to approve permissions. You'll be brought back here once complete.
            </Text>
          </Flex>
        </Card>
      </Box>
    </BrandPageShell>
  );
}

export default function ShopifyOnboardingPage() {
  return (
    <Suspense fallback={
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    }>
      <ConnectShopifyContent />
    </Suspense>
  );
}