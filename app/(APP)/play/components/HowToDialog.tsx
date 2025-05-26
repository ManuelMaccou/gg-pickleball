'use client';

import { AlertDialog, Button, Flex, Text } from '@radix-ui/themes';
import { useCallback } from 'react';

interface HowToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HowToDialog({ open, onOpenChange }: HowToDialogProps) {

  const handleCloseHowToDialog = useCallback(() => {
    localStorage.setItem('howto', 'seen');
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <Flex direction={'column'} my={'5'}>
          <AlertDialog.Title align={'center'} size={'6'} weight={'bold'}>Welcome to GG Pickleball</AlertDialog.Title>
          <AlertDialog.Description align={'center'} size="5" weight={'bold'} mb="4">
            How it works
          </AlertDialog.Description>
          <Flex direction="column" asChild>
            <ol style={{ paddingLeft: '1.25rem', listStyleType: 'decimal' }}>
              <li>
               <Text size="4">After your match, tap &quot;Log match&quot;.</Text>
              </li>
              <li>
                <Text size="4">Have everyone else from your match scan the same QR code on one of your devices.</Text>
              </li>
              <li>
                <Text size="4">Enter your scores.</Text>
              </li>
              <li>
                <Text size="4">Unlock discounts on reservations, programming, and gear.</Text>
              </li>
            </ol>
          </Flex>

          <Flex direction={'column'} gap={'9'} justify={'center'} mt={'6'} style={{width: '250px', marginRight: 'auto', marginLeft: 'auto'}}>
            <Button onClick={handleCloseHowToDialog}>Got it</Button>
          </Flex>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
