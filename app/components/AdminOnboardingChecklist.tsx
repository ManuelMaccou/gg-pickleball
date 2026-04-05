'use client';

import { Card, Flex, Heading, Text, Box, Button, Progress, Badge } from '@radix-ui/themes';
import { CheckCircledIcon, CircleIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { FrontendUser } from '../types/frontendTypes';
import { IClient } from '../types/databaseTypes';
import { ClientUser } from '../contexts/UserContext';

interface OnboardingChecklistProps {
  user: ClientUser; 
  client: IClient;
  hasRewards: boolean;
}

export function AdminOnboardingChecklist({ user, client, hasRewards }: OnboardingChecklistProps) {
  const router = useRouter();

  // 1. Determine the state of each step
  const isAccountClaimed = !!user?.accountClaimed;
  const isShopifyConnected = !!client.shopify?.accessToken;
  const isRewardsCreated = hasRewards;

  // Calculate overall progress (0 to 3)
  const completedSteps = [isAccountClaimed, isShopifyConnected, isRewardsCreated].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 3) * 100);

  // If all steps are complete, we can hide the checklist entirely!
  if (completedSteps === 3) {
    return null; 
  }

  return (
    <Card size="4" style={{ backgroundColor: 'var(--slate-1)', border: '1px solid var(--slate-5)' }} mb="6">
      <Flex direction="column" gap="4">
        
        {/* Header & Progress Bar */}
        <Box>
          <Flex justify="between" align="end" mb="2">
            <Box>
              <Heading size="5" mb="1">Welcome to GG Pickleball!</Heading>
              <Text size="2" color="gray">Complete these steps to launch your rewards program.</Text>
            </Box>
            <Text size="2" weight="bold" color="lime">{completedSteps} of 3 Completed</Text>
          </Flex>
          <Progress value={progressPercent} color="lime" style={{ height: '8px' }} />
        </Box>

        <Flex direction="column" gap="3" mt="3">
          
          {/* STEP 1: Activate Account */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isAccountClaimed ? <CheckCircledIcon width="24" height="24" color="green" /> : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isAccountClaimed ? 'gray' : 'ruby'}>1. Activate Your Account</Text>
                <Text as="div" size="2" color="gray">Set your secure password and log in.</Text>
              </Box>
            </Flex>
            {/* If they are looking at this page, they are logged in, so this is likely already done via your PostLogin webhook! */}
            {isAccountClaimed ? (
                <Badge color="green" variant="soft">Completed</Badge>
            ) : (
                <Badge color="amber" variant="soft">Pending verification</Badge>
            )}
          </Flex>

          {/* STEP 2: Connect Shopify */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isShopifyConnected ? <CheckCircledIcon width="24" height="24" color="green" /> : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isShopifyConnected ? 'gray' : 'ruby'}>2. Connect Shopify</Text>
                <Text as="div" size="2" color="gray">Link your store so we can generate and track reward codes.</Text>
              </Box>
            </Flex>
            {isShopifyConnected ? (
                <Badge color="green" variant="soft">Connected</Badge>
            ) : (
                <Button size="2" variant="soft" onClick={() => {
                  // Scroll down to the Shopify section, or open the settings dialog
                  router.push('/admin/brand/connect-shopify'); 
                }}>
                  Connect Store <ArrowRightIcon />
                </Button>
            )}
          </Flex>

          {/* STEP 3: Create Rewards */}
          <Flex align="center" justify="between" p="3" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--slate-4)' }}>
            <Flex align="center" gap="3">
              {isRewardsCreated ? <CheckCircledIcon width="24" height="24" color="green" /> : <CircleIcon width="24" height="24" color="gray" />}
              <Box>
                <Text as="div" weight="bold" size="3" color={isRewardsCreated ? 'gray' : 'ruby'}>3. Create Rewards</Text>
                <Text as="div" size="2" color="gray">Set up the discounts and perks you want to offer players.</Text>
              </Box>
            </Flex>
            {isRewardsCreated ? (
                <Badge color="green" variant="soft">Created</Badge>
            ) : (
                <Button size="2" variant="soft" disabled={!isShopifyConnected} onClick={() => {
                  // Navigate to reward creation page/tab
                  router.push('/admin/brand/rewards'); 
                }}>
                  Create First Reward <ArrowRightIcon />
                </Button>
            )}
          </Flex>

        </Flex>
      </Flex>
    </Card>
  );
}