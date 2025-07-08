"use client"

import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Dialog, Flex, Link, VisuallyHidden } from "@radix-ui/themes"

export default function MobileMenu() {

  return (
     <Dialog.Root>
      <Dialog.Trigger>
        <Flex direction="column" justify="center" align="center" mx="4">
        <HamburgerMenuIcon width="30px" height="30px" />
      </Flex>
      </Dialog.Trigger>

      <Dialog.Content
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          margin: 0,
          height: '100vh',
          width: '90vw',
          transform: 'none',
          backgroundColor: '#F1F1F1',
        }}>
          <VisuallyHidden>
            <Dialog.Title>Mobile menu</Dialog.Title>
            <Dialog.Description>Mobile menu</Dialog.Description>
          </VisuallyHidden>
        
          <Flex direction={'column'} py={'4'} px={'2'}>
            <Flex direction={'column'} gap={'3'} px={'2'}>
              <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                <Link href={'/admin'}>Dashboard</Link>
              </Flex>
              <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                <Link href={'/admin/achievements'}>Set achievements</Link>
              </Flex>
              <Flex asChild direction={'column'} width={'100%'} pl={'3'} py={'1'}>
                <Link href={'/admin/rewards'}>Configure rewards</Link>
              </Flex>
            </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}