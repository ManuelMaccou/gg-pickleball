'use client';

import { Flex, Text } from '@radix-ui/themes';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string; // omit for the current/last crumb
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Flex align="center" gap="1">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Flex key={i} align="center" gap="1">
            {i > 0 && <ChevronRightIcon color="var(--gray-8)" width="14" height="14" />}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} style={{ textDecoration: 'none' }}>
                <Text size="2" style={{ cursor: 'pointer', color: 'gray' }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>
                  {crumb.label}
                </Text>
              </Link>
            ) : (
              <Text size="2" weight={isLast ? 'medium' : undefined}
                style={{ color: isLast ? 'white' : 'var(--gray-9)' }}>
                {crumb.label}
              </Text>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}