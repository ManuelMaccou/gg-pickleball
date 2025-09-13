'use client'

import { useRouter } from 'next/navigation';
import { Button, Card, Flex, Heading, Strong, Text } from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

export default function NotCloseEnoughPage() {
  const router = useRouter();

  return (
    <Flex align="center" justify="center" px={'3'} style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: 500, padding: '2rem' }}>
        <Flex direction="column" gap="4">
          <Heading align={'center'}>Location error</Heading>
          <Text color="gray">
            To log a match, this app needs permission to access your location.
          </Text>
          <Text color="gray" weight={'bold'}>iOS</Text>
          <Text color="gray" mt={'-3'}>
            Go to Settings &gt; Privacy & Security &gt; Location Services. 
            Ensure it is on, and check the setting for your specific browser (e.g., Safari or Chrome)
          </Text>
          <Text color="gray" weight={'bold'}>Android</Text>
          <Text color="gray" mt={'-3'}>
            Go to Settings &gt; Location. Ensure it is on. 
            You can also check app-specific permissions under Settings &gt; Apps &gt; 
            [Your Browser] &gt; Permissions &gt; Location
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