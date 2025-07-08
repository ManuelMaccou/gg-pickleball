'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { Card, Callout, Flex, Heading, Text, Spinner } from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png';
import { areObjectsDifferent } from '@/utils/objectDiff';
import { BasePopulatedDoc } from '@/app/types/frontendTypes';
import { DataComparisonCard } from '../components/DataComparisonCard';

interface ClientForReview {
  _id: string;
  name: string;
  achievements: BasePopulatedDoc[];
  altAchievements: BasePopulatedDoc[];
  rewardsPerAchievement: Record<string, BasePopulatedDoc>;
  altRewardsPerAchievement: Record<string, BasePopulatedDoc>;
}

export default function GgAdmin() {
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const { user } = useUserContext();
  const isMobile = useIsMobile();

  const [clientsForReview, setClientsForReview] = useState<ClientForReview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/client');
        if (!response.ok) {
          throw new Error('Failed to fetch clients');
        }
        const data = await response.json();
        setClientsForReview(data.clients as ClientForReview[]);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClients();
  }, []);

  const handleCopyData = async (
    clientId: string,
    fieldToUpdate: 'achievements' | 'rewardsPerAchievement'
  ) => {
    const client = clientsForReview.find((c) => c._id === clientId);
    if (!client) return;

    setUpdatingClientId(clientId);

    const sourceField =
      fieldToUpdate === 'achievements' ? 'altAchievements' : 'altRewardsPerAchievement';
    const payload = { [fieldToUpdate]: client[sourceField as keyof ClientForReview] };

    try {
      // Replace with actual API call
      console.log(`Simulating PATCH for client ${clientId} with payload:`, payload);
      await new Promise((res) => setTimeout(res, 1000));

      setClientsForReview((current) =>
        current.map((c) => (c._id === clientId ? { ...c, ...payload } : c))
      );
    } catch (error) {
      console.error(`Failed to update ${fieldToUpdate} for client ${clientId}`, error);
    } finally {
      setUpdatingClientId(null);
    }
  };

  const userName = user?.name;

  if (isMobile === null) return null;

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

      {/* Admin Content Area */}
      <Flex direction="column" p={{ initial: '3', md: '8' }}>
        <Heading size="7" mb="4">
          Client Configuration Review
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
                    </Flex>

                    <DataComparisonCard
                      title="Achievements"
                      sourceData={client.altAchievements}
                      destinationData={client.achievements}
                      onCopy={() => handleCopyData(client._id, 'achievements')}
                      isUpdating={updatingClientId === client._id}
                    />

                    <DataComparisonCard
                      title="Rewards Per Achievement"
                      sourceData={client.altRewardsPerAchievement}
                      destinationData={client.rewardsPerAchievement}
                      onCopy={() => handleCopyData(client._id, 'rewardsPerAchievement')}
                      isUpdating={updatingClientId === client._id}
                    />
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
  );
}
