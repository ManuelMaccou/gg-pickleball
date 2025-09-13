'use client'

import { useRouter } from 'next/navigation';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

export default function NotCloseEnoughPage() {
  const router = useRouter();

  return (
    <Flex align="center" justify="center" px={'3'} style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: 500, padding: '2rem' }}>
        <Flex direction="column" gap="4" align="center">
          <Heading>Location error</Heading>
          <Text align="center" color="gray">
            To log a match, this app needs permission to access your location. 
            Please enable location services for this website in your browser settings and try again.
          </Text>
          <Button asChild size={'3'}>
            <Link href={'mailto:play@ggpickleball.co'}>
              Contact us
            </Link>
          </Button>
          <Button mt={'4'} size="3" variant='ghost' onClick={() => router.push('/play')}>
            <ArrowLeftIcon />
            Go Back
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}