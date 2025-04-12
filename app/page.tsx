'use client'

import { useMediaQuery } from 'react-responsive';
import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import Image from "next/image";
import lightGguprLogo from '../public/logos/ggupr_logo_white_transparent.png'
import Link from 'next/link';

export default function Ggupr() {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  if (!isMobile) {
    return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'}>
        <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
          <Image
            src={lightGguprLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
            style={{
              width: 'auto',
              maxHeight: '170px',
            }}
          />
          <Text mt={'4'} size={'5'} weight={'bold'}>DUPR for recreational players</Text>
          <Text size={'5'} weight={'bold'}>A GG Pickleball experiment</Text>
        </Flex>

        <Flex direction={'column'} justify={'center'} align={'center'}>
          <Text size={'6'} align={'center'}>This app is optimized for mobile devices only.</Text>
        </Flex>
      </Flex>
    )
  }

  return (
      <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'} pb={'9'}>
        <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
          <Image
            src={lightGguprLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
            style={{
              width: 'auto',
              maxHeight: '170px',
            }}
          />
          <Text mt={'4'} size={'5'} weight={'bold'}>DUPR for recreational players</Text>
          <Text size={'5'} weight={'bold'}>A GG Pickleball experiment</Text>
        </Flex>
        <Flex direction={'column'} align={'center'}>
          <Heading size={'8'}>How to:</Heading>
        </Flex>
        <Flex direction={'column'} px={'9'}>
         
          <Text asChild>
            <ol className="list-decimal list-outside space-y-2">
              <li>Open this page after your next match</li>
              <li>Select the court location (optional)</li>
              <li>Have everyone scan the same QR code on your device</li>
              <li>Select your teammate</li>
              <li>Enter the match score</li>
            </ol>
          </Text>
          
        </Flex>
        <Flex direction={'column'} px={'9'}>
          <Text weight={'bold'} mt={'-5'}>Bookmark this page for easy access</Text>
        </Flex>

        <Flex direction={'column'} px={'9'}>
          <Button size={'3'} asChild><Link href={'/ggupr/new'}>Got it</Link></Button>
        </Flex>
       
  
      </Flex>

   
  )
}