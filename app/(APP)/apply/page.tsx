'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Container,
  Flex,
  Box,
  Heading,
  Text,
  Button,
} from '@radix-ui/themes';
import { ArrowRight, Mail, Briefcase, Globe } from 'lucide-react';
import darkGgLogo from '../../../public/logos/gg_logo_black_transparent.png';

export default function ApplyLandingPage() {
  return (
    <Box
      style={{
        backgroundColor: '#0a0a0a',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Lime glow */}
      <Box style={{
        position: 'absolute', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(178,255,0,0.18) 0%, rgba(178,255,0,0.04) 40%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 2,
      }} />

      {/* Header */}
      <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Flex justify="between" align="center" pt="6" pb="6">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Image src={darkGgLogo} alt="GG Pickleball" height={32} width={60} style={{ objectFit: 'contain' }} />
          </Link>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Text size="2" style={{ color: 'rgba(255,255,255,0.6)' }}>← Back to home</Text>
          </Link>
        </Flex>
      </Container>

      <Container size="3" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Flex
          direction="column" align="center" justify="center" py="9" gap="6"
          style={{ minHeight: '70vh', textAlign: 'center' }}
        >
          {/* Icon */}
          <Box style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: 'rgba(178,255,0,0.1)',
            border: '1px solid rgba(178,255,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={32} strokeWidth={2} color="#b2ff00" />
          </Box>

          {/* Heading */}
          <Box>
            <Heading size="9" mb="4" style={{
              color: '#FFFFFF', letterSpacing: '-0.025em',
              lineHeight: 1.05, maxWidth: 700,
            }}>
              Thanks for your interest in joining GG Pickleball.
            </Heading>
            <Text size="5" style={{
              color: 'rgba(255,255,255,0.72)', lineHeight: 1.55,
              maxWidth: 560, display: 'block', margin: '0 auto',
            }}>
              First, we'll verify your business email. Then we'll ask a few quick
              questions about your brand. The whole thing takes about two minutes.
            </Text>
          </Box>

          {/* What you'll need */}
          <Box style={{
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
            padding: '24px 32px', backgroundColor: 'rgba(255,255,255,0.02)',
            maxWidth: 480, width: '100%', textAlign: 'left', marginTop: 8,
          }}>
            <Text size="1" weight="bold" mb="3" style={{
              display: 'block', color: '#b2ff00',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              What you'll need
            </Text>
            <Flex direction="column" gap="3">
              {[
                {
                  icon: <Mail size={16} strokeWidth={2.5} color="#b2ff00" />,
                  label: 'A business email address',
                  note: "Personal emails like gmail aren't accepted.",
                },
                {
                  icon: <Briefcase size={16} strokeWidth={2.5} color="#b2ff00" />,
                  label: 'A Shopify storefront',
                  note: 'We integrate directly with Shopify.',
                },
                {
                  icon: <Globe size={16} strokeWidth={2.5} color="#b2ff00" />,
                  label: 'A website and brief description',
                  note: 'About a paragraph on what you sell.',
                },
              ].map((item) => (
                <Flex key={item.label} align="start" gap="3">
                  <Box style={{
                    width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: 'rgba(178,255,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {item.icon}
                  </Box>
                  <Box>
                    <Text size="3" weight="bold" style={{ color: '#FFFFFF' }}>{item.label}</Text>
                    <Text size="2" style={{ color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: 2 }}>
                      {item.note}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>

          {/* CTA */}
          <Box mt="4">
            <Button asChild size="4" radius="full" style={{ backgroundColor: '#b2ff00', color: '#0a0a0a' }}>
              <Link href="/auth/login?screen_hint=signup&returnTo=/apply/details">
                <Flex align="center" gap="2">
                  Continue
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Flex>
              </Link>
            </Button>
            <Text size="2" mt="3" style={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              We'll send you a one-time code to confirm your email.
            </Text>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}