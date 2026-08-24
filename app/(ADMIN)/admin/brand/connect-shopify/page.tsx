'use client';

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
  const [hasConfiguredRewards, setHasConfiguredRewards] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [changeWarningOpen, setChangeWarningOpen] = useState(false);

  // [Onboarding fix] These three replace the old hasActivePlan-from-DB
  // state. shopDomain and hasActivePlan sitting in the DB don't get
  // cleared when a token dies — only accessToken does, and that field is
  // never sent to the browser at all (stripped server-side for security),
  // so this page could never have checked it directly even before this
  // bug. isVerifiedConnected is the actual "is there a working credential
  // right now" signal, sourced from the same live check
  // BrandAdminDashboard already trusts — not a second, independent
  // implementation of the same idea.
  const [statusChecked, setStatusChecked] = useState(false);
  const [isVerifiedConnected, setIsVerifiedConnected] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [statusReason, setStatusReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push(`/auth/login?returnTo=${encodeURIComponent('/admin/brand/connect-shopify')}`);
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch(`/api/admin?userId=${user.id}`, { cache: 'no-store' });
        if (res.status === 204 || res.status === 403) { router.replace('/error?reason=no_admin_permissions'); return; }
        if (!res.ok) { router.replace('/error?reason=unknown'); return; }
        const data = await res.json();
        setAdminPermission(data.admin?.permission ?? null);
        setLocation(data.location ?? null);
        setHasConfiguredRewards(!!data.location?.hasConfiguredRewards);
        const shopDomainFromDB = data.location?.shopify?.shopDomain;
        const installUrlFromDB = data.location?.shopify?.installUrl ?? null;
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

  // [Onboarding fix] Live connection check — same endpoint and same trust
  // level as BrandAdminDashboard's Effect 2. Runs once the admin fetch has
  // resolved. If there's no location at all (fetch failed, or this
  // account isn't a Shopify retailer), there's nothing to check — treat
  // as not connected and release the loading gate immediately rather than
  // waiting forever on an effect that will never fire.
  useEffect(() => {
    if (isAdminChecking) return;

    if (!location) {
      setStatusChecked(true);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/brand/shopify-status', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          // Couldn't verify — don't claim a connection we can't confirm.
          // Falls through to State 3 (reconnect CTA), the safe default.
          setIsVerifiedConnected(false);
          setHasActivePlan(false);
          setStatusReason('check_failed');
        } else {
          setIsVerifiedConnected(!!data.connected);
          setHasActivePlan(!!data.hasActivePlan);
          setStatusReason(data.reason ?? null);
        }
      } catch (e) {
        console.error('[ConnectShopify] Failed to check Shopify status:', e);
        setIsVerifiedConnected(false);
        setHasActivePlan(false);
        setStatusReason('check_failed');
      } finally {
        setStatusChecked(true);
      }
    };
    checkStatus();
  }, [isAdminChecking, location?._id]);

  if (isAuthLoading || isAdminChecking || !statusChecked) {
    return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  }

  const isReconnecting = !!searchParams.get('reconnect');
  // [Onboarding fix] Mode-aware — this page has nothing to do with billing
  // in custom mode at all (that's a fully separate page/flow), so
  // hasActivePlan doesn't gate "connected" here in that mode. Public mode
  // is untouched — hasActivePlan there still means "App Pricing plan
  // selected," which genuinely is part of what "connected" means for that
  // mode's State 2 below.
  const isFullyConnected = isVerifiedConnected && (CUSTOM_MODE || hasActivePlan);

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
  // In custom mode this branch can't fire at all — isFullyConnected above
  // doesn't require hasActivePlan in custom mode, so a verified connection
  // already resolved to STATE 1. Billing lives entirely on its own separate
  // page in custom mode; this page has no business branching on it.
  if (isVerifiedConnected && !hasActivePlan && !isReconnecting && !CUSTOM_MODE) {
    const pricingUrl = buildShopifyPricingUrl(connectedShop ?? '');

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
  // Reached whenever isVerifiedConnected is false — regardless of what
  // shopDomain/hasActivePlan still say in the DB. This is the branch that
  // used to be unreachable once a token died, since the old check only
  // ever looked at those two DB fields.
  const wasConnectedBefore = statusReason === 'uninstalled';

  return (
    <BrandPageShell adminPermission={adminPermission} location={location} contentMaxWidth="600px">
      <Flex direction="column" align="center" gap="5" pt="9">
        <Heading size="6" align="center">
          {wasConnectedBefore ? 'Reconnect Shopify' : 'Connect Shopify'}
        </Heading>
        <Text align="center" color="gray" size="3">
          {wasConnectedBefore
            ? "Your Shopify connection was lost — this can happen if the app was uninstalled or access was revoked. Reconnect to restore full functionality."
            : 'Connect your Shopify store to GG Pickleball to start issuing rewards to players. Once complete, you\'ll be brought back here automatically.'}
        </Text>

        <Flex gap="3" mt="2" align="center">
          {CUSTOM_MODE ? (
            // Use Shopify's generated signed install link stored in DB.
            // Falls back to custom-install route if no URL is stored yet.
            installUrl ? (
              <Button size="2" asChild>
                <a href={installUrl}>
                  {wasConnectedBefore ? 'Reconnect Shopify' : 'Connect Shopify'}
                </a>
              </Button>
            ) : (
              <>
                <Button size="2" asChild>
                  <a href="/api/shopify/custom-install">
                    {wasConnectedBefore ? 'Reconnect Shopify' : 'Connect Shopify'}
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
                {wasConnectedBefore ? 'Reconnect Shopify ↗' : 'Connect Shopify ↗'}
              </a>
            </Button>
          )}
          <Button variant="soft" color="gray" onClick={() => router.push('/admin/brand')}>
            Go to Dashboard
          </Button>
        </Flex>

        <Text size="1" color="gray" align="center" style={{ maxWidth: 420 }}>
          Make sure you're logged in here before clicking. You'll need an active
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