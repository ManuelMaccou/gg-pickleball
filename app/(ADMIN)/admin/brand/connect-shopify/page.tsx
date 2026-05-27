'use client';

import { useEffect, useState, Suspense } from 'react';
import { Flex, Heading, Text, TextField, Button, Callout, Spinner, Box, Card } from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandPageShell } from '../../components/BrandPageShell';

// ── Inner component (needs useSearchParams → must be inside Suspense) ─────────

function ConnectShopifyContent() {
  const { user } = useUserContext();
  const { isLoading: isAuthLoading } = useAuth0User();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shopDomain, setShopDomain] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Admin / location state — needed to pass to BrandPageShell
  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [location, setLocation] = useState<IClient | null>(null);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [fullyConnectedToShopify, setFullyConnectedToShopify] = useState(false);

  // ── Auth redirect ──
  useEffect(() => {
    if (!isAuthLoading && !user) {
      const returnUrl = encodeURIComponent('/admin/brand/connect-shopify');
      router.push(`/auth/login?returnTo=${returnUrl}`);
    }
  }, [isAuthLoading, user, router]);

  // ── Admin check + redirect if no permissions ──
  useEffect(() => {
    if (isAuthLoading || !user) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch(`/api/admin?userId=${user.id}`);

        if (res.status === 204 || res.status === 403) {
          router.replace('/error?reason=no_admin_permissions');
          return;
        }

        if (!res.ok) {
          router.replace('/error?reason=unknown');
          return;
        }

        const data = await res.json();
        setAdminPermission(data.admin?.permission ?? null);
        setLocation(data.location ?? null);

        const shopDomainFromDB = data.location?.shopify?.shopDomain;
        const accessTokenFromDB = data.location?.shopify?.accessToken;
        if (shopDomainFromDB) {
          setConnectedShop(shopDomainFromDB);
          setShopDomain(shopDomainFromDB);
        }
        if (shopDomainFromDB && accessTokenFromDB) {
          setFullyConnectedToShopify(true);
        }
      } catch (e) {
        console.error('[ConnectShopify] Failed to check admin permissions:', e);
        router.replace('/error?reason=unknown');
      } finally {
        setIsAdminChecking(false);
      }
    };
    checkAdmin();
  }, [user, isAuthLoading, router]);

  // ── Install handler ──
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

  // ── Loading — while auth or admin check is in flight ──
  if (isAuthLoading || isAdminChecking) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    );
  }

  // ── Connected state ──
  // Show this when Shopify is already fully connected and the user hasn't
  // explicitly asked to reconnect (?reconnect=1 bypasses this).
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
          <Flex gap="3" mt="2">
            <Button onClick={() => router.push('/admin/brand')}>
              Go to Dashboard
            </Button>
            <Button
              variant="ghost"
              color="gray"
              onClick={() => router.push('/admin/brand/connect-shopify?reconnect=1')}
            >
              Reconnect / Change Store
            </Button>
          </Flex>
        </Flex>
      </BrandPageShell>
    );
  }

  // ── Main connect form ──
  return (
    <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
      <Box pt="6">
        <Flex direction="column" gap="2" mb="6">
          <Heading size="6">Connect Shopify</Heading>
          <Text color="gray" size="3">
            Enter your Shopify store domain to enable automated reward discounts for players.
          </Text>
        </Flex>

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
              onClick={handleInstall}
              disabled={isRedirecting || !shopDomain.trim()}
            >
              {isRedirecting ? <><Spinner /> Redirecting to Shopify…</> : 'Install App'}
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

// ── Page export ────────────────────────────────────────────────────────────────

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