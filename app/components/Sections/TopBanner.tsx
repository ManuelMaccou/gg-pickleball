import Image from 'next/image'
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import { Box, Button, Dialog, Flex, Separator,  Text, VisuallyHidden } from '@radix-ui/themes'
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { CalendarDays, Gift, User, X, Zap } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export default function TopBanner() {
  
  return (
    <Box>
      <Flex justify={"between"} direction={"row"} pt={"2"} pb={"5"} px={'6'}
        style={{
          backgroundColor: "#191919"
        }}
      >
        <Box>
          <Image
            src={lightGGLogo}
            alt="GG Pickleball dark logo"
            priority
            style={{
              width: 'auto',
              maxHeight: '50px',
            }}
          />
        </Box>
        <Dialog.Root>
          <Dialog.Trigger>
            <HamburgerMenuIcon width={"35px"} height={"35px"}
              style={{
                color: "#FFFFFF"
              }}
            />
          </Dialog.Trigger>
          <Dialog.Content size="1" width="95%" height={'100vh'} 
            style={{
              position: 'fixed',
              right: 0,
              top: 0
            }}
          >
            <VisuallyHidden>
              <Dialog.Title>Mobile menu</Dialog.Title>
              <Dialog.Description>Mobile menu</Dialog.Description>
            </VisuallyHidden>
            
            <Flex direction={'column'} align={'end'} mb={'9'} mt={'6'} pr={'6'} width={'100%'}>
            <Dialog.Close>
              <X />
            </Dialog.Close>

            </Flex>
            
            <Flex direction="column" gap="6">
              {[
                { label: 'Profile', icon: <User />, link: '/profile' },
                { label: 'Schedule', icon: <CalendarDays />, link: '/schedule' },
                { label: 'Challenge', icon: <Zap />, link: '/challenge' },
                { label: 'Perks', icon: <Gift />, link: '/perks' },
              ].map((item) => (
                <React.Fragment key={item.link}>
                  <Link key={item.link} href={item.link} passHref>
                    <Button 
                      key={item.link}
                      variant="ghost"
                      size="4"
                      style={{ 
                        color: 'white', 
                        width: '100%', 
                        justifyContent: 'flex-start', 
                        padding: '12px 16px' 
                      }}
                    >
                      {item.icon}
                      <Text size="6" style={{ marginLeft: '12px' }}>{item.label}</Text>
                    </Button>
                  </Link>
                  <Separator color="yellow" size="4" />
                </React.Fragment>
              ))}

              <Link href="/auth/logout">
                <Flex direction="column" mt={'9'}>
                  <Button size={'4'} variant='ghost'>
                  <Text size={'6'}>Log out</Text>
                  </Button>
                </Flex>
              </Link>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Box>
      

  );
}