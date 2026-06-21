'use client';

// app/(ADMIN)/admin/brand/connect-shopify/page.tsx
//
// Three UI states, identical to the original:
//   1. Fully connected + active billing  → success screen, lock/change dialog
//   2. Connected, no plan (public mode)  → "Almost there" + plan selection CTA
//   3. Not connected                     → install CTA
//
// The only mode-specific change is the install CTA in state 3:
//   Custom mode → "Connect Shopify" links to client.shopify.installUrl stored in DB.
//                 This is Shopify's generated signed install link — works on real stores.
//   Public mode → "Connect Shopify ↗" links to the App Store listing.
//                 Shopify appends shop+hmac and hits /api/shopify/install.
//
// State 2 ("connected, no plan") only appears in public mode — in custom mode,
// billing is handled via Stripe setup after OAuth, so hasActivePlan is set
// by the time the merchant returns to this page.

import { useEffect, useState, Suspense } from 'react';
import {
  Flex, Heading, Text, Button, Spinner, Dialog, Callout,
} from '@radix-ui/themes';
import { CheckCircledIcon, LockClosedIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandPageShell } from '../../components/BrandPageShell';
import { buildShopifyPricingUrl } from '@/lib/shopify/urls';

const SHOPIFY_APP_STORE_URL = 'https://apps.shopify.com/697313e4bf2304b130ef336d8b97b04e/preview/en';
const CUSTOM_MODE = process.env.NEXT_PUBLIC_SHOPIFY_APP_MODE === 'custom';

function ConnectShopifyContent() {
  const { user } = useUserContext();
  const { isLoading: isAuthLoading } = useAuth0User();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [location, setLocation] = useState<IClient | null>(null);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [hasConfiguredRewards, setHasConfiguredRewards] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
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
        const hasActivePlanFromDB = !!data.location?.shopify?.hasActivePlan;
        const installUrlFromDB = data.location?.shopify?.installUrl ?? null;
        setHasActivePlan(hasActivePlanFromDB);
        setInstallUrl(installUrlFromDB);
        if (shopDomainFromDB) setConnectedShop(shopDomainFromDB);
      } catch (e) {
        console.error('[ConnectShopify] Failed to check admin permissions:', e);
        router.replace('/error?reason=unknown');
      } finally {
        setIsAdminChecking(false);
      }
    };
    checkAdmin();
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || isAdminChecking) {
    return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  }

  const isReconnecting = !!searchParams.get('reconnect');
  const isFullyConnected = !!connectedShop && hasActivePlan;

  // ── STATE 1: CONNECTED + ACTIVE BILLING ───────────────────────────────────
  if (isFullyConnected && !isReconnecting) {
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

        {/* Warning dialog — shown before store change when no rewards configured */}
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
              Note: your account can only ever have one Shopify store connected. If you
              continue, you'll be taken to install the app on a new store — but our
              system currently blocks connecting a different store once one is set.
              Contact support first if you need to switch stores.
            </Text>
            <Flex gap="3" justify="end">
              <Button variant="soft" color="gray" onClick={() => setChangeWarningOpen(false)}>
                Cancel
              </Button>
              <Button asChild color="amber">
                <a href="mailto:play@ggpickleball.co?subject=Switch%20Shopify%20Store">
                  Contact Support
                </a>
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </BrandPageShell>
    );
  }

  // ── STATE 2: CONNECTED, NO PLAN (public mode only) ────────────────────────
  // In custom mode this state is skipped — Stripe billing setup happens
  // immediately after OAuth via /admin/brand/billing/payment-method.
  if (connectedShop && !hasActivePlan && !isReconnecting && !CUSTOM_MODE) {
    const pricingUrl = buildShopifyPricingUrl(connectedShop);

    return (
      <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
        <Flex direction="column" align="center" gap="5" pt="9">
          <ExclamationTriangleIcon width={52} height={52} color="var(--amber-9)" />
          <Flex direction="column" align="center" gap="2">
            <Heading size="6" align="center">Almost there</Heading>
            <Text align="center" color="gray" size="3">
              <Text weight="bold">{connectedShop}</Text> is connected, but you haven't
              selected a plan yet. Select a plan to start issuing rewards to players.
            </Text>
          </Flex>

          <Flex gap="3" mt="2">
            <Button asChild color="amber">
              <a href={pricingUrl} target="_blank" rel="noopener noreferrer">
                Select a Plan ↗
              </a>
            </Button>
            <Button variant="soft" color="gray" onClick={() => router.push('/admin/brand')}>
              Go to Dashboard
            </Button>
          </Flex>
        </Flex>
      </BrandPageShell>
    );
  }

  // ── STATE 3: NOT CONNECTED (or reconnecting) ──────────────────────────────
  return (
    <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
      <Flex direction="column" align="center" gap="5" pt="9">
        <Heading size="6" align="center">Connect Shopify</Heading>
        <Text align="center" color="gray" size="3">
          Connect your Shopify store to GG Pickleball to start issuing rewards to players.
          Once complete, you'll be brought back here automatically.
        </Text>

        <Flex gap="3" mt="2" align="center">
          {CUSTOM_MODE ? (
            // Use Shopify's generated signed install link stored in DB.
            // Falls back to custom-install route if no URL is stored yet.
            installUrl ? (
              <Button size="2" asChild>
                <a href={installUrl}>
                  Connect Shopify
                </a>
              </Button>
            ) : (
              <>
                <Button size="2" asChild>
                  <a href="/api/shopify/custom-install">
                    Connect Shopify
                  </a>
                </Button>
                <Callout.Root color="amber" size="1">
                  <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                  <Callout.Text>
                    No install URL configured for this account. Contact support.
                  </Callout.Text>
                </Callout.Root>
              </>
            )
          ) : (
            // Public mode — App Store listing. Shopify appends shop+hmac and
            // hits /api/shopify/install when the merchant clicks Install.
            <Button size="2" asChild>
              <a href={SHOPIFY_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                Connect Shopify ↗
              </a>
            </Button>
          )}
          <Button variant="soft" color="gray" onClick={() => router.push('/admin/brand')}>
            Go to Dashboard
          </Button>
        </Flex>

        <Text size="1" color="gray" align="center" style={{ maxWidth: 420 }}>
          Make sure you're logged in here before clicking — you'll need an active
          session to finish connecting after approving on Shopify.
        </Text>
      </Flex>
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