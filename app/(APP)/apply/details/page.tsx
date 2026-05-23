'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import {
  Container,
  Flex,
  Box,
  Heading,
  Text,
  Button,
  Checkbox,
  Spinner,
  Callout,
} from '@radix-ui/themes';
import { ArrowRight, InfoIcon } from 'lucide-react';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png';

const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 500;

export default function ApplyDetailsPage() {
  const router = useRouter();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();

  // Auth gate
  useEffect(() => {
    if (auth0IsLoading) return;
    if (!auth0User) {
      router.replace('/auth/login?screen_hint=signup&returnTo=/apply/details');
    }
  }, [auth0User, auth0IsLoading, router]);

  // Application state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [shopifyConfirmed, setShopifyConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load existing draft (or create one) on mount
  useEffect(() => {
    if (!auth0User) return;
    const load = async () => {
      try {
        const res = await fetch('/api/brand/apply/draft');
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? 'Could not load your application.');
          return;
        }
        const app = data.application;

        // If they've already submitted, redirect appropriately
        if (app.status === 'pending') {
          router.replace('/apply/submitted');
          return;
        }
        if (app.status === 'approved') {
          router.replace('/admin/brand');
          return;
        }

        // Draft — populate fields
        setBrandName(app.brandName ?? '');
        setWebsite(app.website ?? '');
        setDescription(app.description ?? '');
        setShopifyConfirmed(app.shopifyConfirmed ?? false);
      } catch {
        setLoadError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth0User, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/brand/apply/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          website,
          description,
          shopifyConfirmed,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push('/apply/submitted');
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (auth0IsLoading || loading) {
    return (
      <Box
        style={{
          backgroundColor: '#0a0a0a',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size="3" />
      </Box>
    );
  }

  const descriptionLength = description.length;
  const descriptionValid =
    descriptionLength >= DESCRIPTION_MIN && descriptionLength <= DESCRIPTION_MAX;
  const formValid =
    brandName.trim().length >= 2 &&
    website.trim().length > 0 &&
    descriptionValid &&
    shopifyConfirmed;

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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center top, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center top, black 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Header */}
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
          <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Step 2 of 2
          </Text>
        </Flex>
      </Container>

      <Container size="2" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Box py="6">
          <Heading
            size="8"
            mb="3"
            style={{
              color: '#FFFFFF',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            Tell us about your brand.
          </Heading>
          <Text
            size="4"
            style={{
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.55,
              display: 'block',
              marginBottom: 32,
            }}
          >
            A few quick questions and you're done. We'll review and get back
            to you within a few business days.
          </Text>

          {loadError && (
            <Callout.Root color="amber" mb="5">
              <Callout.Icon>
                <InfoIcon size={16} />
              </Callout.Icon>
              <Callout.Text>{loadError}</Callout.Text>
            </Callout.Root>
          )}

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="5">
              {/* Brand name */}
              <Box>
                <Text
                  size="1"
                  weight="bold"
                  mb="2"
                  style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Brand name
                </Text>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Acme Paddles"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    outline: 'none',
                  }}
                />
              </Box>

              {/* Website */}
              <Box>
                <Text
                  size="1"
                  weight="bold"
                  mb="2"
                  style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Website
                </Text>
                <input
                  type="text"
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourbrand.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    outline: 'none',
                  }}
                />
              </Box>

              {/* Description */}
              <Box>
                <Flex justify="between" align="center" mb="2">
                  <Flex direction={'row'} gap={'2'} align={'center'}>
                    <Text
                      size="1"
                      weight="bold"
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Description
                    </Text>
                    <Text
                        size="2"
                        style={{
                          color: 'rgba(255,255,255,0.55)',
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                      (minimum 30 characters)
                    </Text>
                  </Flex>
                  
                  <Text
                    size="1"
                    style={{
                      color:
                        descriptionLength > DESCRIPTION_MAX
                          ? '#FCA5A5'
                          : descriptionLength >= DESCRIPTION_MIN
                          ? '#b2ff00'
                          : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {descriptionLength} / {DESCRIPTION_MAX}
                  </Text>
                </Flex>
                <textarea
                  required
                  rows={5}
                  minLength={DESCRIPTION_MIN}
                  maxLength={DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us about your company and what you sell."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 120,
                  }}
                />
              </Box>

              {/* Shopify checkbox */}
              <Box
                style={{
                  padding: 16,
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                >
                  <Checkbox
                    size="2"
                    checked={shopifyConfirmed}
                    onCheckedChange={(c) => setShopifyConfirmed(!!c)}
                    color="lime"
                    style={{ marginTop: 2 }}
                  />
                  <Box>
                    <Text size="3" weight="bold" style={{ color: '#FFFFFF' }}>
                      My store is on Shopify
                    </Text>
                    <Text
                      size="2"
                      style={{
                        color: 'rgba(255,255,255,0.55)',
                        display: 'block',
                        marginTop: 2,
                      }}
                    >
                      We integrate directly with Shopify. If you're not on Shopify, we
                      can't process your application at this time.
                    </Text>
                  </Box>
                </label>
              </Box>

              {/* Error */}
              {submitError && (
                <Callout.Root color="red" size="1">
                  <Callout.Text>{submitError}</Callout.Text>
                </Callout.Root>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="4"
                radius="full"
                disabled={!formValid || submitting}
                style={{
                  backgroundColor: '#b2ff00',
                  color: '#0a0a0a',
                  cursor: !formValid || submitting ? 'not-allowed' : 'pointer',
                  opacity: !formValid || submitting ? 0.5 : 1,
                  marginTop: 8,
                }}
              >
                {submitting ? (
                  <Flex align="center" gap="2">
                    <Spinner size="2" /> Submitting…
                  </Flex>
                ) : (
                  <Flex align="center" gap="2">
                    Submit application
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </Flex>
                )}
              </Button>

              <Text
                size="1"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                By submitting, you agree to the 5% commission billing model on
                redeemed sales.
              </Text>
            </Flex>
          </form>
        </Box>
      </Container>
    </Box>
  );
}