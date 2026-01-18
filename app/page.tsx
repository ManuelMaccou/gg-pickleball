'use client'; // Add this if you use React hooks for animations in the future

import Link from 'next/link';
import { Container, Flex, Grid, Box, Heading, Text, Card, Badge, Button } from '@radix-ui/themes';
import { BarChartIcon, CheckCircledIcon, MagicWandIcon, RocketIcon } from '@radix-ui/react-icons';
import styles from './(APP)/HomePage.module.css';
import React from 'react';
import { PartnerLogos } from './components/PartnerLogos';
import { Sparkles, Trophy } from 'lucide-react';

const Benefit = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  // Use a Radix Card as the base
  <Card size="3" className={styles.benefitCard}>
    {/* Use Flex for the layout and `gap` for spacing */}
    <Flex gap="5" align="start">
      {/* Icon Container */}
      <Flex
        align="center"
        justify="center"
        // Use style prop with theme variables for custom looks
        style={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-3)',
          backgroundColor: 'var(--lime-9)', // gg-green
          color: 'var(--slate-12)', // gg-navy
          boxShadow: 'var(--shadow-3)',
        }}
      >
        {icon}
      </Flex>
      {/* Text Container */}
      <Flex direction="column">
        <Heading as="h3" size="4" weight="bold">
          {title}
        </Heading>
        <Text as="p" color="gray" mt="2" style={{ lineHeight: 1.7 }}>
          {description}
        </Text>
      </Flex>
    </Flex>
  </Card>
);

// Sub-component: StepCard
const StepCard = ({ num, title, description, icon }: { num: string; title: string; description: string; icon: React.ReactNode }) => (
    <Flex direction="column" align="center" p="4" position="relative">
      <Box mb="5" position="relative">
        <Flex 
          align="center" justify="center" 
          style={{ width: 80, height: 80, borderRadius: '9999px', backgroundColor: 'var(--slate-12)', color: 'white', boxShadow: '0 10px 15px -3px var(--lime-a4)', border: '4px solid var(--lime-9)' }}
        >
          {icon}
        </Flex>
        <Flex 
          align="center" justify="center"
          position="absolute"
          style={{ top: -10, right: -10, width: 32, height: 32, borderRadius: '9999px', backgroundColor: 'white', color: 'var(--slate-12)', border: '2px solid var(--slate-3)', boxShadow: 'var(--shadow-2)' }}
        >
            <Text weight="bold">{num}</Text>
        </Flex>
      </Box>
      <Heading as="h4" size="4" weight="bold" mb="2">{title}</Heading>
      <Text as="p" color="gray" align="center" style={{lineHeight: '1.7'}}>{description}</Text>
    </Flex>
);

export default function HomePage() {
  return (
    <Box>
      {/* Hero Section */}
      <Box style={{ minHeight: '90vh', position: 'relative', overflow: 'hidden' }}>
        <div className={styles.heroBackground}></div>
        <div className={styles.heroGradientOverlay}></div>
        
        <Container size="4" style={{ position: 'relative', zIndex: 10 }}>
          <Flex align="center" style={{ minHeight: '90vh' }} pt="9">
            <Box style={{ maxWidth: '600px' }}>
              <Badge color="lime" variant="soft" highContrast size="2" mb="6" radius='full' style={{borderStyle: 'solid', borderWidth: '1px', borderColor: '#b2ff00'}} className={styles.fadeIn}>
                <Text size={'4'}>🚀</Text><Text style={{color: "#b2ff00"}}>The #1 Rewards Platform for Pickleball</Text> 
              </Badge>
              <Heading as="h1" weight="bold" mb="5" style={{color: '#FFFFFF', fontSize: '90px', lineHeight: '1'}}  className={styles.slideUp}>
                Your Game, <br/>
                <span className={styles.heroTextGradient}>Rewarded.</span>
              </Heading>
              <Text as="p" size="6" mb="7" className={styles.slideUp} style={{ color: '#FFFFFF', animationDelay: '0.2s', lineHeight: 1.6 }}>
                Sign up for free and turn your passion for pickleball into exclusive offers from the best brands in the sport.
              </Text>
              <Flex gap="4" direction={{ initial: 'column', xs: 'row' }} className={styles.slideUp} style={{ animationDelay: '0.4s' }}>
                <Button asChild size={'4'} radius='full' color='lime'>
                  <Link href="/players">Start Earning</Link>
                </Button>
                <Button asChild size="4" radius="full" variant="outline" color="lime" style={{ color: '#FFFFFF' }}>
                  <Link href="mailto:play@ggpickleball.co">Partner With Us</Link>
                </Button>
              </Flex>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Partner Logos */}
      <Box py="9" style={{backgroundColor: '#FFFFFF'}}>
        <Container size="4">
          <Flex direction="column" align="center" gap="3" mb="8">
            <Heading align="center" size="8" weight="bold">Rewards From Top Brands</Heading>
          </Flex>
          <PartnerLogos />
          <Flex direction={'column'} align={'center'} mt={'6'}>
            <Text align={'center'} size={'5'} weight={'bold'}>...and more</Text>
          </Flex>
        </Container>
      </Box>
      
      {/* How It Works */}
      <Box py="9" style={{ backgroundColor: 'var(--gray-3)' }}>
        <Container size="4">
          <Flex direction="column" align="center" gap="2" mb="9">
            <Text color="lime" weight="bold" size="2" style={{ letterSpacing: '0.1em' }}>SIMPLE PROCESS</Text>
            <Heading align="center" size="8" weight="bold">How It Works</Heading>
          </Flex>
          <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="6">
            <StepCard num="1" title="Play Matches" description="Compete in any partnered league, club, or tournament event." icon={<Trophy width="32" height="32" />} />
            <StepCard num="2" title="We Verify" description="Our system identifies your participation and achievements automatically." icon={<MagicWandIcon width="32" height="32" />} />
            <StepCard num="3" title="Unlock Perks" description="Receive exclusive offers from top pickleball brands." icon={<RocketIcon width="32" height="32" />} />
            <StepCard num="4" title="Level Up" description="Use your rewards to get the best gear and keep improving." icon={<BarChartIcon width="32" height="32" />} />
          </Grid>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Box py="9" style={{ backgroundColor: 'var(--gray-1)' }}>
        <Container size="4">
          <Flex direction="column" align="center" gap="3" mb="9" style={{ textAlign: 'center' }}>
            <Heading as="h2" size="8" weight="bold">
              Play Hard, Get Rewarded
            </Heading>
            <Text color="gray" size="5" style={{ maxWidth: '45rem' }}>
              GG Pickleball is a celebration of your commitment to the game.
            </Text>
          </Flex>
    
          {/* Use the Radix Grid component */}
          <Grid columns={{ initial: '1', md: '2' }} gap="6">
            <Benefit 
              icon={<RocketIcon width="28" height="28" />} 
              title="Exclusive Offers" 
              description="Get access to deals and discounts you won't find anywhere else, from paddles to apparel." 
            />
            <Benefit 
              icon={<Sparkles width="28" height="28" />} 
              title="Discover New Gear" 
              description="Be the first to know about new products from emerging and established sporting goods brands." 
            />
            <Benefit 
              icon={<BarChartIcon width="28" height="28" />} 
              title="Track Your Progress" 
              description="See a history of your rewards and connect them to your match performance over time." 
            />
            <Benefit 
              icon={<CheckCircledIcon width="28" height="28" />} 
              title="100% Free for Players" 
              description="No fees, no subscriptions. Just pure rewards for playing the game you love." 
            />
          </Grid>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box py="9">
        <Container size="3">
          <Card size="5" style={{ backgroundColor: 'var(--lime-9)' }}>
            <Flex direction="column" align="center" gap="4" p={{ initial: '4', sm: '8' }}>
              <Heading align="center" size="9" weight="bold" style={{ color: 'var(--slate-12)' }}>Ready to Join the Fun?</Heading>
              <Text align="center" size="5" style={{ color: 'var(--slate-a11)', maxWidth: '40rem' }} mb="5">
                Signing up is fast, free, and connects you to a world of exclusive pickleball perks.
              </Text>
              <Flex gap="4" direction={{ initial: 'column', xs: 'row' }} width="100%" justify="center">
                {/* Here we use Radix Buttons directly for custom colors */}
                <Button asChild size="4" radius="full" style={{ backgroundColor: 'var(--slate-12)', color: 'white' }} className={styles.ctaButton}>
                    <Link href="/auth">Sign Up For Free</Link>
                </Button>
              </Flex>
            </Flex>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}