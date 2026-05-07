'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import {
  Container,
  Flex,
  Grid,
  Box,
  Heading,
  Text,
  Card,
  Badge,
  Button,
  Spinner,
} from '@radix-ui/themes';
import {
  ArrowRight,
  Zap,
  RefreshCw,
  Sparkles,
  Check,
  Plus,
  Minus,
} from 'lucide-react';
import styles from './(APP)/HomePage.module.css';

// ---------- Helper components ----------

const FeatureCard = ({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <Card
    size="4"
    style={{
      backgroundColor: 'var(--slate-1)',
      border: '1px solid var(--slate-4)',
      height: '100%',
    }}
  >
    <Flex direction="column" gap="4" height="100%">
      <Flex
        align="center"
        justify="center"
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: 'var(--slate-12)',
          color: 'var(--lime-9)',
        }}
      >
        {icon}
      </Flex>
      <Box>
        <Text
          size="1"
          weight="bold"
          style={{
            color: 'var(--lime-11)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </Text>
        <Heading as="h3" size="5" mt="2" mb="2" style={{ color: 'var(--slate-12)' }}>
          {title}
        </Heading>
        <Text size="3" style={{ color: 'var(--slate-11)', lineHeight: 1.6 }}>
          {description}
        </Text>
      </Box>
    </Flex>
  </Card>
);

const FaqItem = ({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <Box
    style={{
      borderBottom: '1px solid var(--slate-4)',
      paddingTop: 20,
      paddingBottom: 20,
    }}
  >
    <button
      onClick={onToggle}
      style={{
        all: 'unset',
        cursor: 'pointer',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
      aria-expanded={isOpen}
    >
      <Text size="4" weight="bold" style={{ color: 'var(--slate-12)' }}>
        {question}
      </Text>
      <Flex
        align="center"
        justify="center"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: isOpen ? 'var(--lime-9)' : 'var(--slate-3)',
          color: isOpen ? 'var(--slate-12)' : 'var(--slate-11)',
          flexShrink: 0,
          transition: 'background-color 0.2s ease',
        }}
      >
        {isOpen ? <Minus size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      </Flex>
    </button>
    {isOpen && (
      <Box pt="3" pr="8">
        <Text size="3" style={{ color: 'var(--slate-11)', lineHeight: 1.7 }}>
          {answer}
        </Text>
      </Box>
    )}
  </Box>
);

// ---------- Page ----------

export default function HomePage() {
  const router = useRouter();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [isGettingOnboardingState, setIsGettingOnboardingState] = useState<boolean>(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // --- ONBOARDING & ROUTING REDIRECT LOGIC (unchanged) ---
  useEffect(() => {
    if (auth0IsLoading) return;

    if (!auth0User) {
      setIsGettingOnboardingState(false);
      return;
    }

    const checkUserStatus = async () => {
      try {
        const res = await fetch(`/api/user/role?auth0Id=${auth0User.sub}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.isSuperAdmin || data.isClubAdmin) {
          router.replace('/admin/brand');
        } else {
          router.replace('/play');
        }
      } catch (error) {
        console.error('Error checking user status for redirect:', error);
      } finally {
        setIsGettingOnboardingState(false);
      }
    };

    checkUserStatus();
  }, [auth0User, auth0IsLoading, router]);

  // --- LOADING STATE ---
  if (auth0IsLoading || isGettingOnboardingState) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}
      >
        <Spinner size="3" />
      </Flex>
    );
  }

  const faqs = [
    {
      question: 'Is GG Pickleball really free?',
      answer:
        "Yes — completely. No subscriptions, no credit card, no hidden fees. Brands sponsor the rewards because they want to reach active players. You play, we sync your matches, they get exposure to a passionate community. Everyone wins.",
    },
    {
      question: 'How does the DUPR sync work?',
      answer:
        'Connect your DUPR account once and GG Pickleball pulls in your match history. You never have to manually log a game, upload a screenshot, or report a score. New matches show up, rewards update — all in the background.',
    },
    {
      question: 'What kind of rewards can I actually earn?',
      answer:
        'Discounts on paddles and gear, free merch, and exclusive offers from brands you already love. The more you play, the more you unlock.',
    },
    {
      question: 'Do I need to play at a specific club?',
      answer:
        "No. As long as your matches are recorded in DUPR, they count — whether you're at a tournament or a league night.",
    },
    {
      question: 'What happens to my data?',
      answer:
        'We only read your DUPR match history to power your rewards. We never sell your data, and you can disconnect or delete your account at any time.',
    },
  ];

  return (
    <Box style={{ backgroundColor: '#ffffff' }}>
      {/* ============ HERO ============ */}
      <Box
        style={{
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
          minHeight: '92vh',
        }}
      >
        {/* Subtle grid texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Large soft glow orb — right side */}
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            right: '-10%',
            transform: 'translateY(-50%)',
            width: '70vw',
            maxWidth: 900,
            height: '70vw',
            maxHeight: 900,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(178,255,0,0.35) 0%, rgba(178,255,0,0.12) 25%, rgba(178,255,0,0.03) 50%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Smaller, more saturated orb for depth */}
        <Box
          style={{
            position: 'absolute',
            top: '30%',
            right: '5%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(178,255,0,0.25) 0%, transparent 60%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
          {/* Top bar — badge left, login right */}
          <Flex justify="between" align="center" pt="9" mb="6">
            <Badge
              color="lime"
              variant="soft"
              size="2"
              radius="full"
              className={styles.fadeIn}
              style={{
                border: '1px solid var(--lime-a6)',
                backgroundColor: 'rgba(178, 255, 0, 0.08)',
                padding: '6px 14px',
              }}
            >
              <Flex align="center" gap="2">
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#b2ff00',
                    boxShadow: '0 0 8px #b2ff00',
                  }}
                />
                <Text size="2" style={{ color: '#b2ff00', letterSpacing: '0.02em' }}>
                  Rewards built for pickleball players
                </Text>
              </Flex>
            </Badge>

            <Button asChild variant="solid" size="3" radius="full" color="lime" style={{
              width: '150px',
            }}>
              <Link href="/auth/login?returnTo=/play">
                Log in
              </Link>
            </Button>
          </Flex>

          {/* Hero content */}
          <Flex align="center" style={{ minHeight: '80vh' }} pb="9">
            <Box style={{ maxWidth: 900 }}>
              <Heading
                as="h1"
                weight="bold"
                mb="5"
                className={styles.slideUp}
                align={{ initial: 'center', md: 'left' }}
                style={{
                  color: '#FFFFFF',
                  fontSize: 'clamp(56px, 9vw, 120px)',
                  lineHeight: 0.92,
                  letterSpacing: '-0.035em',
                }}
              >
                Your game,
                <br />
                <span className={styles.heroTextGradient}>Rewarded.</span>
              </Heading>

              <Text
                as="p"
                size="5"
                mb="7"
                align={{initial: "center", md:'left'}}
                className={styles.slideUp}
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  animationDelay: '0.2s',
                  lineHeight: 1.55,
                  maxWidth: 620,
                }}
              >
                GG Pickleball syncs with your DUPR account and automatically turns every match
                you play into exclusive rewards from the brands shaping the sport.
              </Text>

              <Flex
                gap="3"
                direction={{ initial: 'column', xs: 'row' }}
                className={styles.slideUp}
                style={{ animationDelay: '0.4s' }}
              >
                <Button asChild size="4" radius="full" color="lime" >
                  <Link href="/auth/login?screen_hint=signup&returnTo=/play">
                    <Flex align="center" gap="2">
                      Sign up free
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </Flex>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="4"
                  radius="full"
                  variant="outline"
                  color="lime"
                  highContrast
                  style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255)' }}
                >
                  <Link href="mailto:play@ggpickleball.co">Feature your brand</Link>
                </Button>
              </Flex>

              {/* Trust microcopy under CTA — concrete, no fake stats */}
              <Flex
                gap="5"
                mt="7"
                wrap="wrap"
                justify={{initial: "center", md:'start'}}
                className={styles.slideUp}
                style={{ animationDelay: '0.6s' }}
              >
                {['Free forever', 'No credit card', 'Syncs with DUPR'].map((label) => (
                  <Flex key={label} align="center" gap="2">
                    <Check size={16} strokeWidth={3} color="#b2ff00" />
                    <Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {label}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* ============ FEATURES ============ */}
      <Box py="9" style={{ backgroundColor: '#ffffff' }}>
        <Container size="4" px="5">
          <Flex direction="column" align="center" mb="9">
            <Text
              size="2"
              weight="bold"
              mb="3"
              style={{
                color: 'var(--lime-11)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              How it works
            </Text>
            <Heading
              size="9"
              align="center"
              mb="4"
              style={{
                maxWidth: 720,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
              }}
            >
              Three steps. Zero effort.
            </Heading>
            <Text size="5" align="center" style={{ color: 'var(--slate-11)', maxWidth: 560 }}>
              You sweat on the court. Everything else happens automatically.
            </Text>
          </Flex>

          <Grid columns={{ initial: '1', md: '3' }} gap="5">
            <FeatureCard
              icon={<RefreshCw size={24} strokeWidth={2.5} />}
              eyebrow="Step 01"
              title="Connect your DUPR"
              description="Link your DUPR and pull in your match history automatically — no manual reporting, no screenshots, no spreadsheets."
            />
            <FeatureCard
              icon={<Zap size={24} strokeWidth={2.5} />}
              eyebrow="Step 02"
              title="Play your matches"
              description="Keep playing the way you already do. Leagues, tournaments — every recorded match counts toward your rewards."
            />
            <FeatureCard
              icon={<Sparkles size={24} strokeWidth={2.5} />}
              eyebrow="Step 03"
              title="Unlock rewards"
              description="Earn perks from your favorite brands and discover new ones. Discounts, free gear, exclusive offers — all unlocked just by playing."
            />
          </Grid>
        </Container>
      </Box>

      {/* ============ "WHY FREE" ============ */}
     <Box py="9" style={{ backgroundColor: 'var(--slate-2)' }}>
        <Container size="3" px="5">
          <div style={{
            backgroundColor: '#0f1a0a',
            border: '0.5px solid #2a3d1a',
            overflow: 'hidden',
            position: 'relative',
            borderRadius: 'var(--radius-4)',
            padding: '2rem',
          }}>
            <Box style={{
              position: 'absolute', top: -80, right: -80,
              width: 240, height: 240, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(178,255,0,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <Flex
              direction={{ initial: 'column', md: 'row' }}
              gap="6"
              align={{ initial: 'start', md: 'center' }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <Box style={{ flex: 1 }}>
                <Box
                  mb="4"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'rgba(178,255,0,0.12)',
                    color: '#b2ff00',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    padding: '4px 12px',
                    borderRadius: 999,
                    border: '0.5px solid rgba(178,255,0,0.25)',
                  }}
                >
                  NO CATCH
                </Box>
                <Heading
                  size="8"
                  mb="3"
                  style={{ color: '#f0f4e8', letterSpacing: '-0.02em' }}
                >
                  Wait — why is this free?
                </Heading>
                <Text
                  size="4"
                  style={{ color: '#8fa882', lineHeight: 1.65 }}
                  mb="4"
                >
                  Pickleball brands want to reach active, passionate players. By sponsoring
                  rewards on GG Pickleball, they put their products in front of people who
                  actually play. You get free gear and perks. They get a real audience. {" "}
                </Text>
                <Text size="3" weight="bold" style={{ color: '#b2ff00' }}>
                  No subscriptions. No credit cards. Just pickleball.
                </Text>
              </Box>
              <Box>
                <Button asChild size="4" radius="full" style={{
                  backgroundColor: '#b2ff00',
                  color: '#0f1a0a',
                }}>
                  <Link href="/auth/login?returnTo=/play">
                    <Flex align="center" gap="2">
                      Activate my profile
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </Flex>
                  </Link>
                </Button>
              </Box>
            </Flex>
          </div>
        </Container>
      </Box>

      {/* ============ FAQ ============ */}
      <Box py="9" style={{ backgroundColor: '#ffffff' }}>
        <Container size="3" px="5">
          <Flex direction="column" align="center" mb="8">
            <Text
              size="2"
              weight="bold"
              mb="3"
              style={{
                color: 'var(--lime-11)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              FAQ
            </Text>
            <Heading
              size="9"
              align="center"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
            >
              Questions, answered.
            </Heading>
          </Flex>

          <Box>
            {faqs.map((faq, i) => (
              <FaqItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ============ FINAL CTA ============ */}
      <Box
        py="9"
        style={{
          backgroundColor: '#0a0a0a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Container size="3" px="5" style={{ position: 'relative', zIndex: 1 }}>
          <Flex direction="column" align="center" gap="5">
            <Heading
              size="9"
              align="center"
              style={{
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                maxWidth: 720,
              }}
            >
              Your next match is worth <span className={styles.heroTextGradient}>more</span>.
            </Heading>
            <Text
              size="5"
              align="center"
              style={{ color: 'rgba(255,255,255,0.72)', maxWidth: 520 }}
            >
              Sign up free, sync your DUPR, and start unlocking rewards from the brands you love.
            </Text>
            <Button asChild size="4" radius="full" color="lime" mt="2">
              <Link href="/auth/login?returnTo=/play">
                <Flex align="center" gap="2">
                  Sign up free
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Flex>
              </Link>
            </Button>
          </Flex>
        </Container>
      </Box>

      {/* ============ FOOTER ============ */}
      <Box py="6" style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid var(--slate-12)' }}>
        <Container size="4" px="5">
          <Flex
            justify="between"
            align="center"
            direction={{ initial: 'column', sm: 'row' }}
            gap="4"
          >
            <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              &copy; {new Date().getFullYear()} GG Pickleball. All rights reserved.
            </Text>
            <Flex gap="5">
              <Link href="mailto:manuel@ggpickleball.co" style={{ textDecoration: 'none' }}>
                <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Feature your brand
                </Text>
              </Link>
              <Link href="mailto:play@ggpickleball.co" style={{ textDecoration: 'none' }}>
                <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Contact
                </Text>
              </Link>
            </Flex>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}