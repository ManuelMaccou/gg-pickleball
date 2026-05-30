'use client';

import { Flex } from '@radix-ui/themes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { AdminPermissionType, IClient } from '@/app/types/databaseTypes';
import { BrandHeader } from './BrandHeader';
import { BrandSidebar } from './BrandSidebar';

interface BrandPageShellProps {
  adminPermission: AdminPermissionType;
  location: IClient | null;
  children: React.ReactNode;
  /**
   * Max-width for the inner content column.
   * - any other CSS width — custom width
   * - `'none'` — fill the canvas (use for pages with their own full-width layout, like the rewards page)
   */
  contentMaxWidth?: string;
  /**
   * Padding around the inner content. Defaults to `{ initial: '4', md: '6' }`.
   * Pass `'0'` for pages that need to flush against the canvas edges.
   */
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

  return (
    <Flex
      direction="column"
      style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}
    >
      <BrandHeader adminPermission={adminPermission} />

      <Flex direction="row" style={{ height: 'calc(100vh - 64px)' }}>
        {!isMobile && adminPermission === 'admin' && (
          <BrandSidebar location={location} />
        )}

        {useFullWidth ? (
          // Full-width pages own their own layout; we just provide the canvas.
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