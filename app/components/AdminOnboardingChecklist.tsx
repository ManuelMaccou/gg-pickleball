'use client';

// app/(ADMIN)/admin/brand/AdminOnboardingChecklist.tsx
//
// Mode-aware onboarding checklist for brand admins.
//
// Public mode steps (4 total):
//   1. Activate account
//   2. Connect Shopify + select plan
//   3. Create rewards
//   4. Customize reward card
//
// Custom mode steps (5 total):
//   1. Activate account
//   2. Connect Shopify (OAuth only — no plan selection)
//   3. Set up billing (Stripe payment method)
//   4. Create rewards
//   5. Customize reward card

import { Card, Flex, Heading, Text, Box, Button, Progress, Badge, Callout } from '@radix-ui/themes';
import { CheckCircle2, Circle, ArrowRight, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IClient } from '@/app/types/databaseTypes';
import { ClientUser } from '@/app/contexts/UserContext';
import { RewardCardCustomizer } from '@/app/(ADMIN)/admin/components/RewardCardCustomizer';
import { buildShopifyPricingUrl } from '@/lib/shopify/urls';

const CUSTOM_MODE = process.env.NEXT_PUBLIC_SHOPIFY_APP_MODE === 'custom';

interface OnboardingChecklistProps {
  user: ClientUser;
  client: IClient;
  hasRewards: boolean;
  totalRewardsIssued?: number;
  onClientUpdated?: (updates: {
    cardBackgroundImage?: string;
    cardTextColor?: string;
    logo?: string;
  }) => void;
}

export function AdminOnboardingChecklist({
  user,
  client,
  hasRewards,
  totalRewardsIssued = 0,
  onClientUpdated,
}: OnboardingChecklistProps) {
  const router = useRouter();
  const [cardCustomizerOpen, setCardCustomizerOpen] = useState(false);

  // Custom mode: fetch Stripe billing status from /api/billing/setup
  const [isBillingConfigured, setIsBillingConfigured] = useState(false);
  const [billingLoading, setBillingLoading] = useState(CUSTOM_MODE);

  useEffect(() => {
    if (!CUSTOM_MODE) return;
    fetch('/api/billing/setup')
      .then(r => r.json())
      .then(data => setIsBillingConfigured(!!data.configured))
      .catch(() => setIsBillingConfigured(false))
      .finally(() => setBillingLoading(false));
  }, []);

  // ── Step completion ────────────────────────────────────────────────────────
  const isAccountClaimed = !!user?.accountClaimed;
  const hasCredentials   = !!client.shopify?.accessToken;
  const hasActivePlan    = !!client.shopify?.hasActivePlan;

  // Custom mode: "Shopify connected" means OAuth complete (credentials exist).
  // Public mode: "Shopify connected" means credentials + active plan.
  const isShopifyConnected = CUSTOM_MODE ? hasCredentials : (hasCredentials && hasActivePlan);

  const isRewardsCreated  = hasRewards;
  const isCardCustomized  = !!(client.cardBackgroundImage || client.cardTextColor !== '#ffffff');

  const totalSteps = CUSTOM_MODE ? 5 : 4;

  const completedSteps = CUSTOM_MODE
    ? [isAccountClaimed, isShopifyConnected, isBillingConfigured, isRewardsCreated, isCardCustomized].filter(Boolean).length
    : [isAccountClaimed, isShopifyConnected, isRewardsCreated, isCardCustomized].filter(Boolean).length;

  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  // Hide when fully complete and rewards are flowing
  if (completedSteps === totalSteps && totalRewardsIssued > 0) return null;

  // All done, no rewards yet — success state
  if (completedSteps === totalSteps) {
    return (
      <Card size="3" mb="6" style={{ backgroundColor: 'var(--green-2)', border: '1px solid var(--green-5)' }}>
        <Flex align="center" gap="4" p="2">
          <Flex align="center" justify="center" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--green-3)' }}>
            <CheckCircle2 size={24} color="var(--green-10)" />
          </Flex>
          <Box>
            <Heading size="4" style={{ color: 'var(--green-11)' }}>You're all set up!</Heading>
            <Text size="2" style={{ color: 'var(--green-10)' }}>
              Your rewards program is live. You'll see activity here as players earn and redeem rewards.
            </Text>
          </Box>
        </Flex>
      </Card>
    );
  }

  // ── Step row ──────────────────────────────────────────────────────────────
  const StepRow = ({
    done,
    title,
    description,
    action,
    warning,
  }: {
    done: boolean;
    title: string;
    description: string;
    action?: React.ReactNode;
    warning?: React.ReactNode;
  }) => (
    <Flex
      direction="column"
      p="3"
      gap="2"
      style={{
        backgroundColor: done ? 'var(--gray-2)' : 'white',
        borderRadius: 10,
        border: '1px solid var(--gray-4)',
        opacity: done ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <Flex align="center" justify="between" gap="3">
        <Flex align="center" gap="3" style={{ flex: 1, minWidth: 0 }}>
          {done
            ? <CheckCircle2 size={20} color="var(--green-10)" style={{ flexShrink: 0 }} />
            : <Circle size={20} color="var(--gray-7)" style={{ flexShrink: 0 }} />}
          <Box>
            <Text as="div" weight="bold" size="3" color={done ? 'gray' : undefined}>{title}</Text>
            <Text as="div" size="2" color="gray">{description}</Text>
          </Box>
        </Flex>
        {action}
      </Flex>
      {warning}
    </Flex>
  );

  // ── Step numbering — shifts in custom mode ─────────────────────────────────
  const stepNum = (publicStep: number) => CUSTOM_MODE
    ? (publicStep >= 3 ? publicStep + 1 : publicStep) // billing inserted at 3, pushes rewards to 4 and card to 5
    : publicStep;

  return (
    <Card size="4" mb="6" style={{ backgroundColor: 'white', border: '1px solid var(--gray-4)' }}>
      <Flex direction="column" gap="4">

        {/* Header & progress */}
        <Box>
          <Flex justify="between" align="end" mb="2">
            <Box>
              <Heading size="5" mb="1">Welcome to GG Pickleball!</Heading>
              <Text size="2" color="gray">Complete these steps to launch your rewards program.</Text>
            </Box>
            <Text size="2" weight="bold" color="lime" style={{ flexShrink: 0 }}>
              {completedSteps} of {totalSteps} complete
            </Text>
          </Flex>
          <Progress value={progressPercent} color="lime" style={{ height: 6 }} />
        </Box>

        <Flex direction="column" gap="2" mt="1">

          {/* Step 1: Activate account — identical in both modes */}
          <StepRow
            done={isAccountClaimed}
            title="1. Activate your account"
            description="Set your secure password and log in."
            action={
              isAccountClaimed
                ? <Badge color="green" variant="soft">Done</Badge>
                : <Badge color="amber" variant="soft">Pending verification</Badge>
            }
          />

          {/* Step 2: Connect Shopify — mode-aware */}
          <StepRow
            done={isShopifyConnected}
            title="2. Connect Shopify"
            description="Link your store so we can generate and track reward codes."
            action={
              isShopifyConnected ? (
                <Badge color="green" variant="soft">Connected</Badge>
              ) : !CUSTOM_MODE && hasCredentials && !hasActivePlan ? (
                // Public mode only: connected but no plan selected
                <Button
                  size="2"
                  color="amber"
                  style={{ flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => {
                    const shopDomain = client.shopify?.shopDomain;
                    if (shopDomain) window.open(buildShopifyPricingUrl(shopDomain), '_blank');
                  }}
                >
                  Select plan <ArrowRight size={14} />
                </Button>
              ) : (
                <Button
                  size="2"
                  variant="soft"
                  style={{ flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => router.push('/admin/brand/connect-shopify')}
                >
                  Connect store <ArrowRight size={14} />
                </Button>
              )
            }
            warning={
              // Public mode only: warn about missing plan
              !CUSTOM_MODE && hasCredentials && !hasActivePlan ? (
                <Callout.Root color="amber" size="1">
                  <Callout.Icon><AlertCircle size={14} /></Callout.Icon>
                  <Callout.Text>
                    Your store is connected but you haven't selected a plan yet.
                    Rewards won't work until a plan is active.
                  </Callout.Text>
                </Callout.Root>
              ) : undefined
            }
          />

          {/* Step 3: Set up billing — custom mode only */}
          {CUSTOM_MODE && (
            <StepRow
              done={isBillingConfigured}
              title="3. Set up billing"
              description="Add a payment method so commissions can be collected automatically."
              action={
                billingLoading ? (
                  <Badge color="gray" variant="soft">Checking…</Badge>
                ) : isBillingConfigured ? (
                  <Badge color="green" variant="soft">Configured</Badge>
                ) : (
                  <Button
                    size="2"
                    variant="soft"
                    disabled={!isShopifyConnected}
                    style={{ flexShrink: 0, cursor: isShopifyConnected ? 'pointer' : 'not-allowed' }}
                    onClick={() => router.push('/admin/brand/billing/payment-method')}
                  >
                    Set up billing <ArrowRight size={14} />
                  </Button>
                )
              }
              warning={
                !isBillingConfigured && !isShopifyConnected ? (
                  <Callout.Root color="gray" size="1">
                    <Callout.Icon><AlertCircle size={14} /></Callout.Icon>
                    <Callout.Text>Connect Shopify first, then set up billing.</Callout.Text>
                  </Callout.Root>
                ) : undefined
              }
            />
          )}

          {/* Step 3 (public) / Step 4 (custom): Create rewards */}
          <StepRow
            done={isRewardsCreated}
            title={`${stepNum(3)}. Create rewards`}
            description="Set up the discounts and perks you want to offer players."
            action={
              isRewardsCreated ? (
                <Badge color="green" variant="soft">Created</Badge>
              ) : (
                <Button
                  size="2"
                  variant="soft"
                  disabled={CUSTOM_MODE ? !isBillingConfigured : !isShopifyConnected}
                  style={{
                    flexShrink: 0,
                    cursor: (CUSTOM_MODE ? isBillingConfigured : isShopifyConnected) ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => router.push('/admin/brand/rewards')}
                >
                  Set up <ArrowRight size={14} />
                </Button>
              )
            }
          />

          {/* Step 4 (public) / Step 5 (custom): Customize reward card */}
          <Flex
            direction="column"
            p="3"
            style={{
              backgroundColor: isCardCustomized && !cardCustomizerOpen ? 'var(--gray-2)' : 'white',
              borderRadius: 10,
              border: '1px solid var(--gray-4)',
              opacity: isCardCustomized && !cardCustomizerOpen ? 0.7 : 1,
              transition: 'opacity 0.2s, background-color 0.2s',
            }}
          >
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap="3" style={{ flex: 1, minWidth: 0 }}>
                {isCardCustomized
                  ? <CheckCircle2 size={20} color="var(--green-10)" style={{ flexShrink: 0 }} />
                  : <Circle size={20} color="var(--gray-7)" style={{ flexShrink: 0 }} />}
                <Box>
                  <Text as="div" weight="bold" size="3" color={isCardCustomized ? 'gray' : undefined}>
                    {stepNum(4)}. Customize your reward card
                  </Text>
                  <Text as="div" size="2" color="gray">
                    Upload a background image and logo for your reward cards.
                  </Text>
                </Box>
              </Flex>
              <Button
                size="2"
                variant="soft"
                color={isCardCustomized ? 'gray' : 'blue'}
                style={{ flexShrink: 0, cursor: 'pointer' }}
                onClick={() => setCardCustomizerOpen(v => !v)}
              >
                {cardCustomizerOpen ? 'Close' : isCardCustomized ? 'Edit' : 'Customize'}
                {!cardCustomizerOpen && <ArrowRight size={14} />}
              </Button>
            </Flex>

            {cardCustomizerOpen && (
              <Box mt="4" pt="4" style={{ borderTop: '1px solid var(--gray-4)' }}>
                <RewardCardCustomizer
                  key={`${client.cardBackgroundImage}-${client.cardTextColor}`}
                  clientId={client._id.toString()}
                  currentBackgroundImage={client.cardBackgroundImage}
                  currentTextColor={client.cardTextColor}
                  currentLogo={client.logo}
                  onSaved={(updates) => {
                    onClientUpdated?.(updates);
                    if (updates.cardBackgroundImage || updates.cardTextColor) {
                      setCardCustomizerOpen(false);
                    }
                  }}
                />
              </Box>
            )}
          </Flex>

        </Flex>
      </Flex>
    </Card>
  );
}