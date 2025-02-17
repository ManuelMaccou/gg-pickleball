'use client'

import { Box, Button, Flex, Heading, Text, Theme } from "@radix-ui/themes";
import Image from "next/image";
import darkGGLogo from "../../public/gg_logo_black_transparent.png"
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

export default function Rules() {
  const router = useRouter()

  const handleGoBack = () => {
    router.back()
  }

  return (
    <Theme appearance="light" accentColor="yellow">
      <Flex direction={'column'} py={'9'} width={'100vw'} align={'center'} className="px-[15px] md:px-[50px] lg:px-[300px]">
        <Flex direction={'column'} align={'start'} width={'100%'} mb={{initial: '9', md: '0'}}>
          <Button 
            size={'4'}
            variant="ghost"
            onClick={handleGoBack}
          >
            <ArrowLeftIcon />
            <Text size={'7'}>Go back</Text>
          </Button>
        </Flex>
        <Flex direction={'column'}>
          <Flex
            mb={'9'}
            className={`relative`}
            direction={'column'}
            maxWidth={'200px'}
          >
            <Image
              src={darkGGLogo}
              alt={'Dark GG Pickleball logo'}
              priority
              style={{
                width: 'auto',
                maxHeight: '125px',
              }}
          />
          </Flex>
        </Flex>
        
        <Flex direction={'column'} gap={'6'}>
          <Box>
            <Heading as="h1">Official Rules</Heading>
          </Box>
          <Box>
            <Text size={'5'}>
              GG Pickleball is a monthly, leaderboard style league with a twist. Teams don&apos;t commit to a 
              specific time or place. Instead our flexible format allows people to play at any time at multiple 
              courts. We match you with teams of similar skill and suggest a court to play on based on player 
              and court availability. This flexibility creates a more inclusive environment for people with busy 
              schedules, families, or just want more opportunities to play with equally skilled opponents.
            </Text>
          </Box>
              
          <Flex gap={'3'} direction={'column'}>
            <Text size={'6'} weight={'bold'}>Registration Fee</Text>
            <Text size="5">
              To remain active each month, players must meet the following requirements:
            </Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Text size="5">
                  • Pay the registration fee prior to the posted start date of the next league season.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Log 4 official games per week in the GG Pickleball platform including scores for the winning and 
                  losing team. See next section for more details.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Log 16 official games per season in the GG Pickleball platform including scores for the winning and losing team.
                </Text>
              </li>
            </ul>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Text size={'6'} weight={'bold'}>Registration Fee</Text>
            <Text size={'5'}>
              Teams can play as many games as they want during the allotted time of each court reservation. However, in 
              order for a game to count towards official standings, it must be logged in the GG Pickleball platform. All 
              players must log the same scores for both the winners and losers. This ensures honest game play. If two teams 
              cannot agree on the scores or the winners and losers, the game will not count. If a player does not log 4 games 
              per week or 16 games for the season, they will not be eligible to win. If a player logs more than 4 games in 
              a given week, only the first 4 games will count.
            </Text>
            <Text size={'5'}>
              Given this requirement, it is recommended teams announce BEFORE the game begins that the next game will be 
              officially scored. 
            </Text>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Text size={'6'} weight={'bold'}>Maximum Number of Same-Team Matches</Text>
            <Text size={'5'}>
              The same two teams can only play each other a maximum of 10 times over the course of the 16-game season. 
              We strongly encourage teams to play as many different opponents as possible, but we understand schedules 
              may not always match up. This is to ensure fair league play. This rule will automatically be enforced on 
              the platform. Official games will not be able to be logged if there are already 10 games logged between 
              the same two teams. 
            </Text>
          </Flex>

          <Flex gap={'3'} direction={'column'}>
            <Text size={'6'} weight={'bold'}>Match Rules for Officially Scored Games</Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>
                <Text size="5">
                  • Games are played to 11.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Games must be won by 2.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • Only teams of 2 are allowed.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • The player closest to the ball calls in or out.
                </Text>
              </li>
              <li>
                <Text size="5">
                  • There is no rule for who serves first.
                </Text>
              </li>
            </ul>
          </Flex>
        </Flex>
      </Flex>
    </Theme>
    
      
  )
}