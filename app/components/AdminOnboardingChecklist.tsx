'use client';

import { Card, Flex, Heading, Text, Box, Button, Progress, Badge } from '@radix-ui/themes';
import { CheckCircledIcon, CircleIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { IClient } from '../types/databaseTypes';
import { ClientUser } from '../contexts/UserContext';
import { useState } from 'react';
import { RewardCardCustomizer } from '../(ADMIN)/admin/components/RewardCardCustomizer';

interface OnboardingChecklistProps {
  user: ClientUser;
  client: IClient;
  hasRewards: boolean;
  totalRewardsIssued?: number;
  billingConfigured?: boolean;
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
  billingConfigured,
  onClientUpdated,
}: OnboardingChecklistProps) {
  const router = useRouter();
  const [cardCustomizerOpen, setCardCustomizerOpen] = useState(false);

  const isAccountClaimed = !!user?.accountClaimed;
  const isShopifyConnected = !!client.shopify?.accessToken;
  const isRewardsCreated = hasRewards;
  const isCardCustomized = !!(client.cardBackgroundImage || client.cardTextColor !== '#ffffff');

  const isBillingConfigured = !!billingConfigured;

  const completedSteps = [
    isAccountClaimed,
    isShopifyConnected,
    isBillingConfigured,
    isRewardsCreated,
    isCardCustomized,
  ].filter(Boolean).length;

  const progressPercent = Math.round((completedSteps / 5) * 100);

  if (completedSteps === 5) {
    if (totalRewardsIssued > 0) return null;
    return (
      <Card size="3" style={{ backgroundColor: 'var(--green-2)', border: '1px solid var(--green-5)' }} mb="6">
        <Flex align="center" gap="4" p="2">
          <Box style={{ backgroundColor: 'var(--green-3)', padding: '12px', borderRadius: '50%' }}>
            <CheckCircledIcon width="24" height="24" color="var(--green-10)" />
          </Box>
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

  return (
    <Card size="4" style={{ backgroundColor: 'var(--slate-1)', border: '1px solid var(--slate-5)' }} mb="6">
      <Flex direction="column" gap="4">

        {/* Header & Progress */}
        <Box>
          <Flex justify="between" align="end" mb="2">
            <Box>
              <Heading size="5" mb="1">Welcome to GG Pickleball!</Heading>
              <Text size="2" color="gray">Complete these steps to launch your rewards program.</Text>
            </Box>
            <Text size="2" weight="bold" color="lime">{completedSteps} of 5 Completed</Text>
          </Flex>
          <Progress value={progressPercent} color="lime" style={{ height: '8px' }} />
        </Box>

        <Flex direction="column" gap="3" mt="3">

          {/* STEP 1: Activate Account */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isAccountClaimed
                ? <CheckCircledIcon width="24" height="24" color="green" />
                : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isAccountClaimed ? 'gray' : 'ruby'}>
                  1. Activate Your Account
                </Text>
                <Text as="div" size="2" color="gray">Set your secure password and log in.</Text>
              </Box>
            </Flex>
            {isAccountClaimed
              ? <Badge color="green" variant="soft">Completed</Badge>
              : <Badge color="amber" variant="soft">Pending verification</Badge>}
          </Flex>

          {/* STEP 2: Connect Shopify */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isShopifyConnected
                ? <CheckCircledIcon width="24" height="24" color="green" />
                : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isShopifyConnected ? 'gray' : 'ruby'}>
                  2. Connect Shopify
                </Text>
                <Text as="div" size="2" color="gray">
                  Link your store so we can generate and track reward codes.
                </Text>
              </Box>
            </Flex>
            {isShopifyConnected
              ? <Badge color="green" variant="soft">Connected</Badge>
              : (
                <Button size="2" variant="soft" onClick={() => router.push('/admin/brand/connect-shopify')}>
                  Connect Store <ArrowRightIcon />
                </Button>
              )}
          </Flex>

          {/* STEP 3: Set Up Billing */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isBillingConfigured
                ? <CheckCircledIcon width="24" height="24" color="green" />
                : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isBillingConfigured ? 'gray' : 'ruby'}>
                  3. Set Up Billing
                </Text>
                <Text as="div" size="2" color="gray">
                  Add a payment method so commissions can be paid out automatically.
                </Text>
              </Box>
            </Flex>
            {isBillingConfigured
              ? <Badge color="green" variant="soft">Configured</Badge>
              : (
                <Button
                  size="2"
                  variant="soft"
                  disabled={!isShopifyConnected}
                  onClick={() => router.push('/admin/brand/billing')}
                >
                  Set Up Billing <ArrowRightIcon />
                </Button>
              )}
          </Flex>

          {/* STEP 4: Create Rewards */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isRewardsCreated
                ? <CheckCircledIcon width="24" height="24" color="green" />
                : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isRewardsCreated ? 'gray' : 'ruby'}>
                  3. Create Rewards
                </Text>
                <Text as="div" size="2" color="gray">
                  Set up the discounts and perks you want to offer players.
                </Text>
              </Box>
            </Flex>
            {isRewardsCreated
              ? <Badge color="green" variant="soft">Created</Badge>
              : (
                <Button
                  size="2"
                  variant="soft"
                  disabled={!isShopifyConnected}
                  onClick={() => router.push('/admin/brand/rewards')}
                >
                  Create First Reward <ArrowRightIcon />
                </Button>
              )}
          </Flex>

          {/* STEP 5: Customize Reward Card */}
          <Flex
            direction="column"
            p="3"
            style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}
          >
            <Flex align="center" justify="between">
              <Flex align="center" gap="3">
                {isCardCustomized
                  ? <CheckCircledIcon width="24" height="24" color="green" />
                  : <CircleIcon width="24" height="24" color="gray" />}
                <Box>
                  <Text as="div" weight="bold" size="3" color={isCardCustomized ? 'gray' : 'ruby'}>
                    4. Customize Your Reward Card
                  </Text>
                  <Text as="div" size="2" color="gray">
                    Upload a background image and logo for your reward cards.
                  </Text>
                </Box>
              </Flex>
              {isCardCustomized
                ? (
                  <Button size="2" variant="soft" color="gray" onClick={() => setCardCustomizerOpen((v) => !v)}>
                    {cardCustomizerOpen ? 'Close' : 'Edit'}
                  </Button>
                )
                : (
                  <Button size="2" variant="soft" onClick={() => setCardCustomizerOpen((v) => !v)}>
                    {cardCustomizerOpen ? 'Close' : 'Customize'} <ArrowRightIcon />
                  </Button>
                )}
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