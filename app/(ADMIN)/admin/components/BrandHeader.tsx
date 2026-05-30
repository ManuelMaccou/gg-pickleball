'use client';

import { Flex, Text, Avatar, Button, Separator } from '@radix-ui/themes';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from '@/app/contexts/UserContext';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminPermissionType } from '@/app/types/databaseTypes';
import MobileMenu from './MobileMenu';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png';

interface BrandHeaderProps {
  adminPermission: AdminPermissionType;
}

export function BrandHeader({ adminPermission }: BrandHeaderProps) {
  const { user } = useUserContext();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const isMobile = useIsMobile();
  const router = useRouter();

  const userName = user?.name;

  const handleLogout = () => {
    router.push('/auth/logout');
  };

  return (
    <Flex
      justify="between"
      align="center"
      height="64px"
      px={{ initial: '3', md: '6' }}
      style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-4)',
        flexShrink: 0,
      }}
    >
      <Flex align="center" gap="4">
        <Image
          src={darkGgLogo}
          alt="GG Pickleball"
          height={32}
          width={60}
          style={{ objectFit: 'contain' }}
        />
      </Flex>

      {!auth0IsLoading && (
        <Flex align="center" gap="3">
          {!isMobile && userName && (
            <Text size="2" color="gray">
              {auth0User ? `Welcome ${String(userName).split('@')[0]}` : userName}
            </Text>
          )}
          {isMobile && adminPermission === 'admin' && <MobileMenu />}
          {!isMobile && (
            <Avatar
              size="2"
              fallback={userName?.charAt(0).toUpperCase() ?? 'A'}
              radius="full"
            />
          )}
          <Button
            size="2"
            variant="outline"
            ml={{ initial: '0', md: '4' }}
            onClick={handleLogout}
          >
            Log Out
          </Button>
        </Flex>
      )}
    </Flex>
  );
}