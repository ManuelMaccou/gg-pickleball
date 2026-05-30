'use client';

import { Flex, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Gift, CreditCard } from 'lucide-react';
import { IClient } from '@/app/types/databaseTypes';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
}

interface BrandSidebarProps {
  location: IClient | null;
}

export function BrandSidebar({ location }: BrandSidebarProps) {
  const pathname = usePathname();

  const isShopifyConnected = !!(
    location?.retailSoftware === 'shopify' &&
    location?.shopify?.shopDomain &&
    location?.shopify?.accessToken
  );

  const items: NavItem[] = [
    {
      href: '/admin/brand',
      label: 'Dashboard',
      icon: <LayoutDashboard size={16} />,
      show: true,
    },
    {
      href: '/admin/brand/rewards',
      label: 'Configure rewards',
      icon: <Gift size={16} />,
      show: isShopifyConnected,
    },
    {
      href: '/admin/brand/billing',
      label: 'Billing',
      icon: <CreditCard size={16} />,
      show: isShopifyConnected,
    },
  ];

  return (
    <Flex
      direction="column"
      width="240px"
      py="4"
      px="3"
      gap="1"
      style={{
        backgroundColor: 'white',
        borderRight: '1px solid var(--gray-4)',
        flexShrink: 0,
      }}
    >
      {items.filter((i) => i.show).map((item) => {
        // Treat exact match as active; for /admin/brand specifically,
        // only highlight when the path is exactly that, since it's the
        // parent of every other route.
        const isActive =
          item.href === '/admin/brand'
            ? pathname === '/admin/brand'
            : pathname.startsWith(item.href);

        return (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <Flex
              align="center"
              gap="3"
              px="3"
              py="2"
              style={{
                borderRadius: 6,
                backgroundColor: isActive ? 'var(--accent-3)' : 'transparent',
                color: isActive ? 'var(--accent-11)' : 'var(--gray-12)',
                borderLeft: isActive ? '3px solid var(--accent-9)' : '3px solid transparent',
                paddingLeft: isActive ? 9 : 12, // compensate for border so text doesn't shift
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'background-color 120ms ease',
              }}
              className="brand-sidebar-item"
            >
              {item.icon}
              <Text size="2">{item.label}</Text>
            </Flex>
          </Link>
        );
      })}

      <style jsx>{`
        :global(.brand-sidebar-item:hover) {
          background-color: var(--gray-3) !important;
        }
      `}</style>
    </Flex>
  );
}