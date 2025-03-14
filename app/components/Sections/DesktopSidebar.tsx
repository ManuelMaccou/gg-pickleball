import { Box, Button, Flex, Text } from "@radix-ui/themes"
import Image from 'next/image'
import lightGGLogo from '../../../public/gg_logo_white_transparent.png'
import { CalendarDays, Gift, User, Zap } from "lucide-react"
import Link from "next/link"

export default function DesktopSidebar() {
  
  return (
    <Flex direction={'column'} pt={'5'} pr={'9'}>
      <Box style={{marginBottom: '100px'}}>
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

      <Flex direction={'column'} gap={'5'}>
        <Flex direction={'row'}>
          <Button variant="ghost" size={'4'} style={{color: 'white'}}>
            <User style={{marginRight: '6px'}}/>
            <Link href={'/profile'}>Profile</Link>
          </Button> 
        </Flex>
        <Flex direction={'row'} gap={'3'}>
          <Button variant="ghost" size={'4'} style={{color: 'white'}}>
            <CalendarDays style={{marginRight: '6px'}}/>
            <Link href={'/schedule'}>Schedule</Link>
          </Button>
        </Flex>
        <Flex direction={'row'} gap={'3'}>
          <Button variant="ghost" size={'4'} style={{color: 'white'}}>
            <Zap style={{marginRight: '6px'}}/>
            <Link href={'/challenge'}>Challenge</Link>
          </Button>
        </Flex>
        <Flex direction={'row'} gap={'3'}>
          <Button variant="ghost" size={'4'} style={{color: 'white'}}>
            <Gift style={{marginRight: '6px'}}/>
            <Link href={'/perks'}>Perks</Link>
          </Button>
        </Flex>
        <Link href="/auth/logout">
          <Flex direction="column" mt={'9'}>
            <Button size={'3'} variant='ghost'>
            <Text size={'4'}>Log out</Text>
            </Button>
          </Flex>
        </Link>
      </Flex>
    </Flex>
  )
}