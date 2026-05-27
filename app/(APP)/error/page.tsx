'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ErrorReason } from '@/lib/errors/redirectToError';

interface ErrorConfig {
  headline: string;
  subheadline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const ERROR_CONFIGS: Record<ErrorReason, ErrorConfig> = {
  no_admin_permissions: {
    headline: "You don't have\na brand account.",
    subheadline: 'Admin access required',
    body: "This page is for GG Pickleball brand partners. If you're a player, head to your dashboard. If you'd like to feature your brand on GG Pickleball, apply below.",
    ctaLabel: 'Apply as a brand',
    ctaHref: '/apply',
    secondaryLabel: 'Go to player dashboard',
    secondaryHref: '/play',
  },
  session_expired: {
    headline: 'Your session\nexpired.',
    subheadline: 'Authentication timeout',
    body: "The connection setup took too long and your login session expired. This is usually a one-time issue — head back to connect Shopify and try again.",
    ctaLabel: 'Try again',
    ctaHref: '/admin/brand/connect-shopify',
    secondaryLabel: 'Go to dashboard',
    secondaryHref: '/admin/brand',
  },
  client_not_found: {
    headline: "We couldn't find\nyour account.",
    subheadline: 'Account not found',
    body: "Your user exists but we couldn't locate your brand account. This can happen if the account was recently created or if something went wrong during setup. Contact support and we'll sort it out.",
    ctaLabel: 'Contact support',
    ctaHref: 'mailto:play@ggpickleball.co',
    secondaryLabel: 'Go home',
    secondaryHref: '/',
  },
  token_exchange_failed: {
    headline: 'Shopify connection\nfailed.',
    subheadline: 'OAuth error',
    body: "We couldn't complete the connection with Shopify. This is usually a temporary issue on Shopify's end. Wait a moment, then try reconnecting.",
    ctaLabel: 'Try reconnecting',
    ctaHref: '/admin/brand/connect-shopify',
    secondaryLabel: 'Contact support',
    secondaryHref: 'mailto:play@ggpickleball.co',
  },
  unknown: {
    headline: 'Something went\nwrong.',
    subheadline: 'Unexpected error',
    body: "We ran into an unexpected problem. Try refreshing or going back. If it keeps happening, contact support and we'll take a look.",
    ctaLabel: 'Go home',
    ctaHref: '/',
    secondaryLabel: 'Contact support',
    secondaryHref: 'mailto:play@ggpickleball.co',
  },
};

const VALID_REASONS: ErrorReason[] = [
  'no_admin_permissions',
  'session_expired',
  'client_not_found',
  'token_exchange_failed',
  'unknown',
];

function isValidReason(value: string | null): value is ErrorReason {
  return VALID_REASONS.includes(value as ErrorReason);
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ───────────

function ErrorContent() {
  const searchParams = useSearchParams();
  const rawReason = searchParams.get('reason');
  const reason: ErrorReason = isValidReason(rawReason) ? rawReason : 'unknown';
  const config = ERROR_CONFIGS[reason];

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'Bricolage Grotesque', 'Archivo', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grain texture */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Lime glow accent behind content */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 300,
          background: 'radial-gradient(ellipse at center, rgba(178,255,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 600,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Eyebrow tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#b2ff00',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {config.subheadline}
          </span>
        </div>

        {/* Main headline */}
        <h1
          style={{
            fontSize: 'clamp(40px, 8vw, 68px)',
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            margin: '0 0 28px',
            whiteSpace: 'pre-line',
          }}
        >
          {config.headline}
        </h1>

        {/* Divider */}
        <div
          style={{
            width: 40,
            height: 3,
            backgroundColor: '#b2ff00',
            marginBottom: 28,
            flexShrink: 0,
          }}
        />

        {/* Body copy */}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 44px',
            fontWeight: 400,
          }}
        >
          {config.body}
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Primary CTA */}
          <Link
            href={config.ctaHref}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#b2ff00',
              color: '#0a0a0a',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              padding: '15px 28px',
              borderRadius: 6,
              textDecoration: 'none',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#c5ff26';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#b2ff00';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            }}
          >
            {config.ctaLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          {/* Secondary CTA */}
          {config.secondaryLabel && config.secondaryHref && (
            <Link
              href={config.secondaryHref}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                fontWeight: 500,
                padding: '14px 28px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              {config.secondaryLabel}
            </Link>
          )}
        </div>

        {/* Footer wordmark */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            GG Pickleball
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>·</span>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
// useSearchParams() must be wrapped in Suspense in Next.js 13+ app router

export default function ErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}