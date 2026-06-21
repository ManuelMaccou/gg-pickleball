'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flex, Text } from '@radix-ui/themes';
import {
  RefreshCw, Settings, CreditCard, Gift, FileText,
  Upload, Shield, Users, ScrollText,
} from 'lucide-react';

interface NavLink {
  href: string;
  text: string;
  icon: React.ReactNode;
  // Optional: treat this href as active when another path is active too
  alsoActiveFor?: string[];
}

const ggAdminLinks: NavLink[] = [
  { href: '/admin/gg/sync',               text: 'Sync',                    icon: <RefreshCw size={16} /> },
  { href: '/admin/gg/config',             text: 'Configure clients',        icon: <Settings size={16} />, alsoActiveFor: ['/admin/gg/onboard'] },
  { href: '/admin/gg/billing',            text: 'Billing',                  icon: <CreditCard size={16} /> },
  { href: '/admin/gg/rewards',            text: 'Global rewards',           icon: <Gift size={16} /> },
  { href: '/admin/gg/rewards-log',        text: 'Rewards log',              icon: <ScrollText size={16} /> },
  { href: '/admin/gg/upload-matches',     text: 'Upload matches',           icon: <Upload size={16} /> },
  { href: '/admin/gg/compliance',         text: 'Compliance',               icon: <Shield size={16} /> },
  { href: '/admin/gg/brand-applications', text: 'Brand applications',       icon: <Users size={16} /> },
];

interface AdminSidebarProps {
  adminPermission: 'admin' | 'associate' | null;
}

export const AdminSidebar = ({ adminPermission }: AdminSidebarProps) => {
  const pathname = usePathname();

  if (adminPermission !== 'admin') return null;

  const linksToShow = pathname.startsWith('/admin/gg') ? ggAdminLinks : [];
  if (linksToShow.length === 0) return null;

  return (
    <Flex
      direction="column"
      width="220px"
      py="4"
      px="3"
      gap="1"
      style={{
        backgroundColor: 'white',
        borderRight: '1px solid var(--gray-4)',
        flexShrink: 0,
      }}
    >
      {linksToShow.map((link) => {
        const isActive =
          pathname === link.href ||
          pathname.startsWith(link.href + '/') ||
          (link.alsoActiveFor?.some(p => pathname.startsWith(p)) ?? false);

        return (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
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
                paddingLeft: isActive ? 9 : 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'background-color 120ms ease',
              }}
              className="gg-sidebar-item"
            >
              {link.icon}
              <Text size="2">{link.text}</Text>
            </Flex>
          </Link>
        );
      })}

      <style jsx>{`
        :global(.gg-sidebar-item:hover) {
          background-color: var(--gray-3) !important;
        }
      `}</style>
    </Flex>
  );
};