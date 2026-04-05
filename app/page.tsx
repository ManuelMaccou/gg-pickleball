'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { Container, Flex, Grid, Box, Heading, Text, Card, Badge, Button, Spinner } from '@radix-ui/themes';
import { ShieldCheck, Gift, Activity, ArrowRight, MailOpen, LockKeyhole } from 'lucide-react';
import { PartnerLogos } from './components/PartnerLogos';
import styles from './(APP)/HomePage.module.css';

const Step = ({ icon, title, description, stepNum }: { icon: React.ReactNode, title: string, description: string, stepNum: number }) => (
  <Flex direction="column" gap="3" position="relative">
    <Flex 
      align="center" 
      justify="center" 
      style={{ 
        width: 48, height: 48, 
        borderRadius: '12px', 
        backgroundColor: 'var(--lime-9)', 
        color: 'var(--slate-12)',
        boxShadow: '0 4px 14px -2px var(--lime-a5)'
      }}
    >
      {icon}
    </Flex>
    <Box>
      <Text size="2" weight="bold" color="lime" style={{ letterSpacing: '0.05em' }}>STEP {stepNum}</Text>
      <Heading as="h3" size="4" mt="1" mb="2">{title}</Heading>
      <Text color="gray" size="3" style={{ lineHeight: 1.6 }}>{description}</Text>
    </Box>
  </Flex>
);

export default function HomePage() {
  const router = useRouter();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [isGettingOnboardingState, setIsGettingOnboardingState] = useState<boolean>(true);

// --- ONBOARDING & ROUTING REDIRECT LOGIC ---
  useEffect(() => {
    if (auth0IsLoading) return;
    
    if (!auth0User) {
      setIsGettingOnboardingState(false);
      return;
    }

    const checkUserStatus = async () => {
      try {
        // Hit our new, lightweight role-checking endpoint
        const res = await fetch(`/api/user/role?auth0Id=${auth0User.sub}`);
        if (!res.ok) return;
        
        const data = await res.json();

        // If they are a Super Admin OR a Club Admin, send them to the brand dashboard
        if (data.isSuperAdmin || data.isClubAdmin) {
             router.replace('/admin/brand'); 
        } else {
             // Normal players go to the app
             router.replace('/play');
        }
        
      } catch (error) {
        console.error("Error checking user status for redirect:", error);
      } finally {
        setIsGettingOnboardingState(false);
      }
    };

    checkUserStatus();
  }, [auth0User, auth0IsLoading, router]);

  // --- LOADING STATE ---
  if (auth0IsLoading || isGettingOnboardingState) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <Box style={{ backgroundColor: '#ffffff' }}>
      
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
                  <Link href="/play">Start Earning</Link>
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

      {/* Value Prop / How it works */}
      <Box py="9">
        <Container size="3" px="4">
          <Flex direction="column" align="center" mb="8">
            <Heading size="8" mb="3">How it works</Heading>
            <Text color="gray" size="5" align="center" style={{ maxWidth: 500 }}>
              You do the sweating on the court. We handle the rest automatically in the background.
            </Text>
          </Flex>

          <Grid columns={{ initial: '1', md: '3' }} gap="7">
            <Step 
              stepNum={1}
              icon={<Activity size={24} strokeWidth={2.5} />}
              title="Play Matches"
              description="Play in leagues, tournaments, or open play at participating clubs. Just record your scores like normal."
            />
            <Step 
              stepNum={2}
              icon={<ShieldCheck size={24} strokeWidth={2.5} />}
              title="We Verify"
              description="Our system securely verifies your match results and updates your GG profile automatically."
            />
            <Step 
              stepNum={3}
              icon={<Gift size={24} strokeWidth={2.5} />}
              title="Unlock Rewards"
              description="Log in to claim exclusive discounts, free gear, and perks from our partnered brands."
            />
          </Grid>
        </Container>
      </Box>

      {/* Why is this free? (Overcoming Skepticism) */}
      <Box py="9" style={{ backgroundColor: 'var(--slate-2)' }}>
        <Container size="3" px="4">
          <Card size="4" style={{ backgroundColor: '#ffffff', border: '1px solid var(--slate-4)' }}>
            <Flex direction={{ initial: 'column', md: 'row' }} gap="6" align="center">
              <Box style={{ flex: 1 }}>
                <Heading size="6" mb="3">Wait, why is this free?</Heading>
                <Text color="gray" size="4" style={{ lineHeight: 1.6 }} mb="4">
                  It sounds too good to be true, but it's simple: Top pickleball brands want to reach active, passionate players. They want to grow with you and reward you as you progress in the sport. 
                </Text>
                <Text weight="bold" color="gray"> No subscriptions. No credit cards. Just pickleball.</Text>
              </Box>
              <Box>
                <Button asChild size="4" radius="full" style={{ backgroundColor: 'var(--slate-12)', color: 'white' }}>
                  <a href="/auth/login?returnTo=/play">Activate My Profile</a>
                </Button>
              </Box>
            </Flex>
          </Card>
        </Container>
      </Box>

      {/* Footer */}
      <Box py="6" style={{ borderTop: '1px solid var(--gray-4)' }}>
        <Container size="4" px="4">
          <Flex justify="between" align="center" direction={{ initial: 'column', sm: 'row' }} gap="4">
            <Text size="2" color="gray">&copy; {new Date().getFullYear()} GG Pickleball. All rights reserved.</Text>
            <Flex gap="4">
              <Link href="mailto:manuel@ggpickleball.co">
                <Text size="2" color="gray" style={{ textDecoration: 'underline' }}>Partner with us</Text>
              </Link>
            </Flex>
          </Flex>
        </Container>
      </Box>

    </Box>
  );
}