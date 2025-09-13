'use client'

import { useRouter } from 'next/navigation';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';

export default function NotCloseEnoughPage() {
  const router = useRouter();

  return (
    <Flex align="center" justify="center" px={'3'} style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: 500, padding: '2rem' }}>
        <Flex direction="column" gap="4" align="center">
          <Heading>Too Far Away</Heading>
          <Text align="center" color="gray">
            You must be at the facility to log a match.
          </Text>
          <Button mt={'4'} size="3" variant='ghost' onClick={() => router.push('/play')}>
            <ArrowLeftIcon />
            Go Back
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}