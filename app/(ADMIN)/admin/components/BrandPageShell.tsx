// Destination: app/(BRAND)/admin/brand/components/BrandPageShell.tsx
'use client';

import { useEffect, useState } from 'react';
import { Flex } from '@radix-ui/themes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandHeader } from './BrandHeader';
import { BrandSidebar } from './BrandSidebar';
import { useShopifyConnectionStatus } from '@/app/hooks/useShopifyConnectionStatus';


interface BrandPageShellProps {
  adminPermission: AdminPermissionType;
  location: IClient | null;
  children: React.ReactNode;
  contentMaxWidth?: string;
  contentPadding?: string | { initial?: string; md?: string };
}

export function BrandPageShell({
  adminPermission,
  location,
  children,
  contentMaxWidth = '1200px',
  contentPadding,
}: BrandPageShellProps) {
  const isMobile = useIsMobile();
  const padding = contentPadding ?? { initial: '4', md: '6' };
  const useFullWidth = contentMaxWidth === 'none';

  // Internal, live-verified copy of `location` — BrandSidebar reads THIS,
  // not the raw prop. Runs the live Shopify check once, here, so no
  // individual page has to remember to do it (this was previously
  // duplicated per-page, which is exactly how one page ended up missing it).
  const [verifiedLocation, setVerifiedLocation] = useState<IClient | null>(location);

  // Sync from the parent's location prop — but for updates to the SAME
  // client, keep whatever the live-check below already patched onto
  // accessToken, so an unrelated field change elsewhere on the page can't
  // silently wipe the verified Shopify status.
  useEffect(() => {
    setVerifiedLocation((prev) => {
      if (!location) return null;
      if (!prev || prev._id !== location._id) return location;
      return {
        ...location,
        shopify: {
          ...location.shopify,
          accessToken: prev.shopify?.accessToken ?? location.shopify?.accessToken,
        },
      } as unknown as IClient;
    });
  }, [location]);

  useShopifyConnectionStatus(verifiedLocation, setVerifiedLocation);

  return (
    <Flex
      direction="column"
      style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}
    >
      <BrandHeader adminPermission={adminPermission} />

      <Flex direction="row" style={{ height: 'calc(100vh - 64px)' }}>
        {!isMobile && adminPermission === 'admin' && (
          <BrandSidebar location={verifiedLocation} />
        )}

        {useFullWidth ? (
          <Flex direction="column" flexGrow="1" overflowY="auto">
            {children}
          </Flex>
        ) : (
          <Flex
            direction="column"
            flexGrow="1"
            overflowY="auto"
            p={padding as any}
          >
            <Flex
              direction="column"
              gap="6"
              style={{
                maxWidth: contentMaxWidth,
                width: '100%',
                margin: '0 auto',
              }}
            >
              {children}
            </Flex>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}