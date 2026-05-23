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
import { Check, ArrowRight } from 'lucide-react';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png';

export default function ApplySubmittedPage() {
  return (
    <Box
      style={{
        backgroundColor: '#0a0a0a',
        minHeight: '100vh',
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
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <Box
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(178,255,0,0.18) 0%, rgba(178,255,0,0.04) 40%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Flex justify="between" align="center" pt="6" pb="6">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Image
              src={darkGgLogo}
              alt="GG Pickleball"
              height={32}
              width={60}
              style={{ objectFit: 'contain' }}
            />
          </Link>
        </Flex>
      </Container>

      <Container size="3" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          py="9"
          gap="6"
          style={{ minHeight: '70vh', textAlign: 'center' }}
        >
          {/* Success icon */}
          <Box
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: '#b2ff00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={36} strokeWidth={3} color="#0a0a0a" />
          </Box>

          <Box>
            <Heading
              size="9"
              mb="4"
              style={{
                color: '#FFFFFF',
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                maxWidth: 700,
              }}
            >
              Application received.
            </Heading>
            <Text
              size="5"
              style={{
                color: 'rgba(255,255,255,0.72)',
                lineHeight: 1.55,
                maxWidth: 540,
                display: 'block',
                margin: '0 auto',
              }}
            >
              We sent you a confirmation email. Our team will review your
              application and get back to you within a few business days.
            </Text>
          </Box>

          <Box mt="4">
            <Button
              asChild
              size="4"
              radius="full"
              variant="outline"
              style={{
                color: '#FFFFFF',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              <Link href="/">
                <Flex align="center" gap="2">
                  Back to home
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Flex>
              </Link>
            </Button>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}