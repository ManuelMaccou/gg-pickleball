'use client';

import { Button, Dialog, Flex } from '@radix-ui/themes';
import Link from 'next/link';

interface LocationHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationHelpDialog({ open, onOpenChange }: LocationHelpDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Title>Enable location access to check in</Dialog.Title>
        <Dialog.Description size="3" mb="4">
          Location permissions have been denied. You won&apos;t be able to check in. You can enable location permissions later in your browser&apos;s settings
        </Dialog.Description>
        <Flex direction={'row'} gap={'9'} justify={'between'} mt={'6'}>
          <Button variant="outline" asChild><Link href={'/'}>Close</Link></Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
