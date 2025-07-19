'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { Card, Callout, Flex, Heading, Text, Spinner, Button } from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';
import { areObjectsDifferent } from '@/utils/objectDiff';
import { BasePopulatedDoc } from '@/app/types/frontendTypes';
import { DataComparisonCard } from '../../components/DataComparisonCard';
import GGAdminSidebar from '../components/GGAdminSidebar';

interface ClientForReview {
  _id: string;
  name: string;
  achievements: BasePopulatedDoc[];
  altAchievements: BasePopulatedDoc[];
  rewardConfigStatus: string;
  rewardsPerAchievement: Record<string, BasePopulatedDoc>;
  altRewardsPerAchievement: Record<string, BasePopulatedDoc>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GgAdminClientSync() {
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user } = useUserContext();
  const isMobile = useIsMobile();

  const { 
    data: apiResponse, 
    error, 
    mutate 
  } = useSWR('/api/client', fetcher, {
    // Optional: Keep data fresh when window is refocused
    revalidateOnFocus: true,
  });

  const clientsForReview: ClientForReview[] = apiResponse?.clients || [];
  const isLoading = !apiResponse && !error;
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<Record<string, 'achievements' | 'rewardsPerAchievement' | null>>({});
  const [pushSuccess, setPushSuccess] = useState<Record<string, boolean>>({});


  const handleCopyData = async (
    clientId: string,
    fieldToUpdate: 'achievements' | 'rewardsPerAchievement'
  ) => {
    const client = clientsForReview.find((c) => c._id === clientId);
    if (!client) return;

    setUpdatingClientId(clientId);

    const payload: {
      clientId: string;
      achievements?: string[];
      rewardsPerAchievement?: Record<string, string>;
      achievementContext?: 'default';
      rewardContext?: 'default';
    } = {
      clientId,
    };

    if (fieldToUpdate === 'achievements') {
      payload.achievements = client.altAchievements.map((ach) => ach._id);
      payload.achievementContext = 'default';
    } else if (fieldToUpdate === 'rewardsPerAchievement') {
      payload.rewardsPerAchievement = Object.fromEntries(
        Object.entries(client.altRewardsPerAchievement).map(([key, reward]) => [key, reward._id])
      );
      payload.rewardContext = 'default';
    }

    try {
      const response = await fetch('/api/client', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Failed to update client');
      }

      await mutate();

      setCopySuccess((prev) => ({
        ...prev,
        [clientId]: fieldToUpdate,
      }));

      setTimeout(() => {
        setCopySuccess((prev) => ({ ...prev, [clientId]: null }));
      }, 3000);

    } catch (error) {
      console.error(`Failed to update ${fieldToUpdate} for client ${clientId}`, error);
    } finally {
      setUpdatingClientId(null);
    }
  };

  const handlePushChanges = async (clientId: string) => {
    setUpdatingClientId(clientId);
    try {
      const response = await fetch('/api/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          rewardConfigStatus: 'active', // The new payload
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Failed to push changes');
      }

      // Re-fetch data to get the updated status
      await mutate();

      // Show a success message
      setPushSuccess((prev) => ({ ...prev, [clientId]: true }));
      setTimeout(() => {
        setPushSuccess((prev) => ({ ...prev, [clientId]: false }));
      }, 3000);

    } catch (error) {
      console.error(`Failed to push changes for client ${clientId}`, error);
    } finally {
      setUpdatingClientId(null);
    }
  };


  const userName = user?.name;

  if (user && !user.superAdmin) {
    return (
      <Flex direction="column" height="100vh">
        <Flex
          justify="between"
          align="center"
          direction="row"
          px={{ initial: '3', md: '9' }}
          py="4"
        >
          <Flex direction="column" position="relative" maxWidth="80px">
            <Image
              src={darkGgLogo}
              alt="GG Pickleball dark logo"
              priority
              height={540}
              width={960}
            />
          </Flex>
          {!auth0IsLoading && (
            <Flex direction="row" justify="center" align="center">
              <Text size="3" weight="bold" align="right">
                {userName
                  ? auth0User
                    ? `Welcome ${
                        String(userName).includes('@') ? String(userName).split('@')[0] : userName
                      }`
                    : `${
                        String(userName).includes('@') ? String(userName).split('@')[0] : userName
                      } (guest)`
                  : ''}
              </Text>
            </Flex>
          )}
        </Flex>
        <Flex direction="column" align="center" justify="center" height="300px">
          <Text>You do not have access to this page</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      {/* Header */}
      <Flex
        justify="between"
        align="center"
        direction="row"
        px={{ initial: '3', md: '9' }}
        py="4"
      >
        <Flex direction="column" position="relative" maxWidth="80px">
          <Image
            src={darkGgLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
          />
        </Flex>
        {!auth0IsLoading && (
          <Flex direction="row" justify="center" align="center">
            <Text size="3" weight="bold" align="right">
              {userName
                ? auth0User
                  ? `Welcome ${
                      String(userName).includes('@') ? String(userName).split('@')[0] : userName
                    }`
                  : `${
                      String(userName).includes('@') ? String(userName).split('@')[0] : userName
                    } (guest)`
                : ''}
            </Text>
          </Flex>
        )}
      </Flex>
      <Flex direction={'column'} width={'100vw'}>
        <Flex direction={'row'} height={'100%'}>
          {!isMobile && (
            <GGAdminSidebar />
          )}

          {/* Admin Content Area */}
          <Flex direction="column" p={{ initial: '3', md: '8' }} width={'100vw'}>
            <Heading size="7" mb="4">
              Client Rewards and Achievements Review
            </Heading>

            {isLoading ? (
              <Flex align="center" justify="center" p="8" gap="3">
                <Spinner size="3" />
                <Text>Loading clients...</Text>
              </Flex>
            ) : clientsForReview.length > 0 ? (
              <Flex direction="column" gap="6">
                {clientsForReview.map((client) => {
                  const achievementsDiffer = areObjectsDifferent(
                    client.achievements,
                    client.altAchievements
                  );
                  const rewardsDiffer = areObjectsDifferent(
                    client.rewardsPerAchievement,
                    client.altRewardsPerAchievement
                  );
                  const actionNeeded = achievementsDiffer || rewardsDiffer;
                  const isAlreadyActive = client.rewardConfigStatus === 'active';

                  return (
                    <Card key={client._id} variant="classic">
                      <Flex direction="column" gap="3">
                        <Flex justify="between" align="start">
                          <Heading>{client.name}</Heading>
                          {actionNeeded ? (
                            <Callout.Root color="orange">
                              <Callout.Icon>
                                <InfoCircledIcon />
                              </Callout.Icon>
                              <Callout.Text>Action Needed</Callout.Text>
                            </Callout.Root>
                          ) : (
                            <Callout.Root color="green">
                              <Callout.Icon>
                                <CheckCircledIcon />
                              </Callout.Icon>
                              <Callout.Text>Configuration Synced</Callout.Text>
                            </Callout.Root>
                          )}

                          {pushSuccess[client._id] && (
                            <Callout.Root color="green" variant="surface">
                              <Callout.Icon><CheckCircledIcon /></Callout.Icon>
                              <Callout.Text>Configuration has been pushed and is now active.</Callout.Text>
                            </Callout.Root>
                          )}
                        </Flex>

                        {copySuccess[client._id] && (
                          <Callout.Root color="green" variant="surface">
                            <Callout.Icon>
                              <CheckCircledIcon />
                            </Callout.Icon>
                            <Callout.Text>
                              {copySuccess[client._id] === 'achievements'
                                ? 'Achievements synced successfully.'
                                : 'Rewards per Achievement synced successfully.'}
                            </Callout.Text>
                          </Callout.Root>
                        )}

                        <DataComparisonCard
                          title="Achievements"
                          sourceData={client.altAchievements}
                          dataType="achievements"
                          destinationData={client.achievements}
                          onCopy={() => handleCopyData(client._id, 'achievements')}
                          isUpdating={updatingClientId === client._id}
                        />

                        <DataComparisonCard
                          title="Rewards Per Achievement"
                          sourceData={client.altRewardsPerAchievement}
                          destinationData={client.rewardsPerAchievement}
                          dataType="rewards"
                          onCopy={() => handleCopyData(client._id, 'rewardsPerAchievement')}
                          isUpdating={updatingClientId === client._id}
                        />
                      </Flex>

                      <Flex justify="end" my={'4'}>
                      <Button
                        onClick={() => handlePushChanges(client._id)}
                        disabled={
                          actionNeeded ||           // Can't push if there are differences
                          isAlreadyActive ||        // Can't push if already active
                          updatingClientId === client._id // Disable while any action is in progress for this client
                        }
                        color="red" // Using a different color to distinguish from 'Sync'
                      >
                        {updatingClientId === client._id ? (
                          <Spinner />
                        ) : isAlreadyActive ? (
                          'Status active'
                        ) : (
                          'Update config status'
                        )}
                      </Button>
                    </Flex>
                    </Card>
                  );
                })}
              </Flex>
            ) : (
              <Callout.Root>
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  No clients currently have alternative configurations awaiting review.
                </Callout.Text>
              </Callout.Root>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}
