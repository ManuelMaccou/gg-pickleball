'use client'

import { Flex, Text } from "@radix-ui/themes"
import Image from "next/image"
import lightGgLogo from '../public/gg_logo_white_transparent.png'

export default function Home() {

  return (
    <Flex direction={'column'} minHeight={'100vh'} p={'4'} justify={'center'} gap={'7'}>
      <Flex direction={'column'} position={'relative'} align={'center'} p={'7'}>
        <Image
          src={lightGgLogo}
          alt="GG Pickleball dark logo"
          priority
          height={540}
          width={960}
          style={{
            width: 'auto',
            maxHeight: '170px',
          }}
        />
      </Flex>

      <Flex direction={'column'} justify={'center'} align={'center'}>
      <Text size={'6'} align={'center'}>Season 1 has ended.</Text>
        <Text size={'6'} align={'center'}>Something new is coming soon.</Text>
      </Flex>
    </Flex>
  
    
  )
}