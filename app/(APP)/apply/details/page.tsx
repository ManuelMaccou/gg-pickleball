'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import {
  Container, Flex, Box, Heading, Text, Button,
  Checkbox, Spinner, Callout,
} from '@radix-ui/themes';
import { ArrowRight, InfoIcon, AlertCircle, RefreshCcw } from 'lucide-react';
import darkGgLogo from '../../../../public/logos/gg_logo_black_transparent.png';

const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 500;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 16,
  fontFamily: 'inherit',
  backgroundColor: 'rgba(0,0,0,0.4)',
  color: '#FFFFFF',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.7)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 8,
};

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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wasRejected, setWasRejected] = useState(false);

  // Form fields
  const [legalCompanyName, setLegalCompanyName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [applicantTitle, setApplicantTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [shopifyConfirmed, setShopifyConfirmed] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load or create draft on mount
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

        if (app.status === 'pending') {
          router.replace('/apply/submitted');
          return;
        }
        if (app.status === 'approved') {
          router.replace('/admin/brand');
          return;
        }

        // The draft API returns wasRejected: true when it creates a new draft
        // after a rejected application, so we can show a contextual notice.
        if (data.wasRejected) {
          setWasRejected(true);
        }

        // Populate from existing draft
        setLegalCompanyName(app.legalCompanyName ?? '');
        setBrandName(app.brandName ?? '');
        setApplicantTitle(app.applicantTitle ?? '');
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
          legalCompanyName, brandName, applicantTitle, website, description,
          shopifyConfirmed, authorityConfirmed, agreementAccepted,
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

  // ── Full-page loading ──────────────────────────────────────────────────────
  if (auth0IsLoading || loading) {
    return (
      <Box style={{
        backgroundColor: '#0a0a0a', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Spinner size="3" />
      </Box>
    );
  }

  // ── Load error — show a proper error state, not the form ──────────────────
  if (loadError) {
    return (
      <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
          <Flex justify="between" align="center" pt="6" pb="6">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Image src={darkGgLogo} alt="GG Pickleball" height={32} width={60} style={{ objectFit: 'contain' }} />
            </Link>
          </Flex>
        </Container>
        <Container size="2" px="5">
          <Flex
            direction="column" align="center" justify="center" gap="5"
            style={{ minHeight: '60vh', textAlign: 'center' }}
          >
            <Flex align="center" justify="center" style={{
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.25)',
            }}>
              <AlertCircle size={24} style={{ color: '#f87171' }} />
            </Flex>
            <Flex direction="column" gap="2" style={{ maxWidth: 380 }}>
              <Heading size="5" style={{ color: '#fff' }}>
                Couldn't load your application
              </Heading>
              <Text size="3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {loadError}
              </Text>
            </Flex>
            <Button
              size="3"
              radius="full"
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#b2ff00', color: '#0a0a0a',
                fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              <RefreshCcw size={16} style={{ marginRight: 6 }} />
              Try again
            </Button>
          </Flex>
        </Container>
      </Box>
    );
  }

  const descriptionLength = description.length;
  const formValid =
    legalCompanyName.trim().length >= 2 &&
    brandName.trim().length >= 2 &&
    applicantTitle.trim().length >= 2 &&
    website.trim().length > 0 &&
    descriptionLength >= DESCRIPTION_MIN &&
    descriptionLength <= DESCRIPTION_MAX &&
    shopifyConfirmed &&
    authorityConfirmed &&
    agreementAccepted;

  return (
    <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Grid texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at center top, black 0%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center top, black 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Header */}
      <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Flex justify="between" align="center" pt="6" pb="6">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Image src={darkGgLogo} alt="GG Pickleball" height={32} width={60} style={{ objectFit: 'contain' }} />
          </Link>
          <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>Brand Application</Text>
        </Flex>
      </Container>

      <Container size="2" px="5" style={{ position: 'relative', zIndex: 10 }}>
        <Box py="6">

          {/* Rejected application notice */}
          {wasRejected && (
            <Box
              mb="6"
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 12,
                padding: '16px 20px',
              }}
            >
              <Flex align="start" gap="3">
                <AlertCircle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                <Box>
                  <Text size="3" weight="bold" style={{ color: '#fbbf24', display: 'block' }}>
                    Your previous application wasn't approved
                  </Text>
                  <Text size="2" style={{ color: 'rgba(251,191,36,0.8)', display: 'block', marginTop: 4 }}>
                    You're welcome to apply again. If you have questions about the decision, reach out to us directly.
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          <Heading size="8" mb="3" style={{ color: '#FFFFFF', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
            Tell us about your brand.
          </Heading>
          <Text size="4" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, display: 'block', marginBottom: 32 }}>
            A few quick questions and you're done. We'll review and get back to you within a few business days.
          </Text>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="5">

              {/* Company Information */}
              <Box style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 20 }}>
                <Text size="2" weight="bold" mb="4" style={{ display: 'block', color: '#b2ff00', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Company Information
                </Text>
                <Flex direction="column" gap="4">
                  <Box>
                    <label style={labelStyle}>Legal Company Name</label>
                    <input
                      type="text" required minLength={2} maxLength={200}
                      value={legalCompanyName}
                      onChange={(e) => setLegalCompanyName(e.target.value)}
                      placeholder="Acme Sports Inc."
                      style={inputStyle}
                    />
                    <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 6 }}>
                      The full legal name of your company. Not displayed publicly — used for agreement records only.
                    </Text>
                  </Box>
                  <Box>
                    <label style={labelStyle}>Brand Display Name</label>
                    <input
                      type="text" required minLength={2} maxLength={100}
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Acme Paddles"
                      style={inputStyle}
                    />
                    <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 6 }}>
                      The name players will see on the platform. Can differ from your legal name.
                    </Text>
                  </Box>
                  <Box>
                    <label style={labelStyle}>Website</label>
                    <input
                      type="text" required
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourbrand.com"
                      style={inputStyle}
                    />
                  </Box>
                </Flex>
              </Box>

              {/* Authorized Representative */}
              <Box style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 20 }}>
                <Text size="2" weight="bold" mb="4" style={{ display: 'block', color: '#b2ff00', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Authorized Representative
                </Text>
                <Box>
                  <label style={labelStyle}>Your Job Title / Role</label>
                  <input
                    type="text" required minLength={2} maxLength={100}
                    value={applicantTitle}
                    onChange={(e) => setApplicantTitle(e.target.value)}
                    placeholder="CEO, VP of Marketing, Owner…"
                    style={inputStyle}
                  />
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 6 }}>
                    Recorded as part of the agreement acceptance record.
                  </Text>
                </Box>
              </Box>

              {/* About Your Brand */}
              <Box style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 20 }}>
                <Text size="2" weight="bold" mb="4" style={{ display: 'block', color: '#b2ff00', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  About Your Brand
                </Text>
                <Box>
                  <Flex justify="between" align="center" mb="2">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Description</label>
                    <Text size="1" style={{
                      color: descriptionLength > DESCRIPTION_MAX ? '#FCA5A5'
                        : descriptionLength >= DESCRIPTION_MIN ? '#b2ff00'
                        : 'rgba(255,255,255,0.4)',
                    }}>
                      {descriptionLength} / {DESCRIPTION_MAX}
                    </Text>
                  </Flex>
                  <textarea
                    required rows={5}
                    minLength={DESCRIPTION_MIN} maxLength={DESCRIPTION_MAX}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about your company and what you sell."
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.5, fontSize: 15 }}
                  />
                </Box>
              </Box>

              {/* Confirmations */}
              <Box>
                <Text size="2" weight="bold" mb="4" style={{ display: 'block', color: '#b2ff00', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Confirmations
                </Text>
                <Flex direction="column" gap="3">
                  {[
                    {
                      checked: shopifyConfirmed,
                      onChange: setShopifyConfirmed,
                      title: 'My store is on Shopify',
                      body: "GG Pickleball integrates directly with Shopify. If you're not on Shopify, we can't process your application at this time.",
                    },
                    {
                      checked: authorityConfirmed,
                      onChange: setAuthorityConfirmed,
                      title: 'I have authority to bind my company',
                      body: 'I confirm that I am an authorized employee, officer, or agent of the company named above, with the authority to enter into legally binding agreements on its behalf.',
                    },
                  ].map(({ checked, onChange, title, body }) => (
                    <Box key={title} style={{ padding: 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                        <Checkbox size="2" checked={checked} onCheckedChange={(c) => onChange(!!c)} color="lime" style={{ marginTop: 2 }} />
                        <Box>
                          <Text size="3" weight="bold" style={{ color: '#FFFFFF' }}>{title}</Text>
                          <Text size="2" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 2 }}>{body}</Text>
                        </Box>
                      </label>
                    </Box>
                  ))}

                  {/* Agreement checkbox — separate because it has a link */}
                  <Box style={{ padding: 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                      <Checkbox size="2" checked={agreementAccepted} onCheckedChange={(c) => setAgreementAccepted(!!c)} color="lime" style={{ marginTop: 2 }} />
                      <Box>
                        <Text size="3" weight="bold" style={{ color: '#FFFFFF' }}>I agree to the Brand Partner Agreement</Text>
                        <Text size="2" style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginTop: 2 }}>
                          I have read and agree to the{' '}
                          <Link href="/legal/partnership-agreement" target="_blank" style={{ color: '#b2ff00', textDecoration: 'underline' }}>
                            GG Pickleball Brand Partner Agreement
                          </Link>
                          , including the 5% commission on redeemed sales. This constitutes a legally binding electronic signature under the E-SIGN Act.
                        </Text>
                      </Box>
                    </label>
                  </Box>
                </Flex>
              </Box>

              {/* Submit error */}
              {submitError && (
                <Callout.Root color="red" size="1">
                  <Callout.Text>{submitError}</Callout.Text>
                </Callout.Root>
              )}

              {/* Submit */}
              <Button
                type="submit" size="4" radius="full"
                disabled={!formValid || submitting}
                style={{
                  backgroundColor: '#b2ff00', color: '#0a0a0a',
                  cursor: !formValid || submitting ? 'not-allowed' : 'pointer',
                  opacity: !formValid || submitting ? 0.5 : 1,
                  marginTop: 8,
                }}
              >
                {submitting ? (
                  <Flex align="center" gap="2"><Spinner size="2" /> Submitting…</Flex>
                ) : (
                  <Flex align="center" gap="2">
                    Submit application <ArrowRight size={18} strokeWidth={2.5} />
                  </Flex>
                )}
              </Button>

              <Text size="1" style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 }}>
                By submitting, your acceptance of the Brand Partner Agreement is recorded with your name, company, title, email address, IP address, and timestamp.
              </Text>
            </Flex>
          </form>
        </Box>
      </Container>
    </Box>
  );
}