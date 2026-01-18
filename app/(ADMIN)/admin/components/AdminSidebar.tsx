'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation'; // The key hook for getting the URL
import { Flex } from '@radix-ui/themes'; // Assuming you are using Radix

// Define the shape of our links for TypeScript
interface NavLink {
  href: string;
  text: string;
}

// Define the link sets for each context
const superAdminLinks: NavLink[] = [
  { href: '/admin', text: 'Dashboard' },
  { href: '/admin/achievements', text: 'Set Achievements' },
  { href: '/admin/rewards', text: 'Configure Rewards' },
  { href: '/admin/upload-matches', text: 'Upload Matches' },
];

const ggAdminLinks: NavLink[] = [
  { href: '/admin/gg/sync', text: 'Sync' },
  { href: '/admin/gg/config', text: 'Configure clients' },
  { href: '/admin/gg/rewards', text: 'Configure global rewards' },
  { href: '/admin/gg/upload-matches', text: 'Upload Matches' },
];

interface AdminSidebarProps {
  adminPermission: 'admin' | 'associate' | null; // Pass the permission level as a prop
}

export const AdminSidebar = ({ adminPermission }: AdminSidebarProps) => {
  // usePathname() gives us the current URL, e.g., "/admin/rewards"
  const pathname = usePathname();

  if (adminPermission !== 'admin') {
    return null; // Don't render anything if the user is not an admin
  }

  // Determine which set of links to show based on the current URL
  let linksToShow: NavLink[] = [];
  if (pathname.startsWith('/admin/gg')) {
    linksToShow = ggAdminLinks;
  } else if (pathname.startsWith('/admin')) {
    linksToShow = superAdminLinks;
  }

  // If no links are determined (e.g., a non-admin page), don't render
  if (linksToShow.length === 0) {
    return null;
  }

  return (
    <Flex
      direction={'column'}
      width={'200px'}
      py={'4'}
      px={'2'}
      style={{ backgroundColor: '#F1F1F1', borderRight: '1px solid #d3d3d3' }}
    >
      <Flex direction={'column'} gap={'3'} px={'2'}>
        {linksToShow.map((link) => {
          // Check if the current link is the active one
          const isActive = pathname === link.href;

          return (
            <Flex
              asChild
              key={link.href}
              direction={'column'}
              width={'100%'}
              pl={'3'}
              py={'1'}
              // Apply the active style dynamically
              style={
                isActive
                  ? { backgroundColor: 'white', borderRadius: '10px' }
                  : {}
              }
            >
              <Link href={link.href}>{link.text}</Link>
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
};