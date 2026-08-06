'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  ExternalLink,
} from 'lucide-react';
import styles from '../HomePage.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Inline product-screen mockup components
// These are pure presentational — no props, no state, no data fetching.
// ─────────────────────────────────────────────────────────────────────────────

const PlayerScreen = () => (
  <div style={{
    background: '#111',
    borderRadius: 16,
    border: '0.5px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
  }}>
    {/* header bar */}
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ width: 36, height: 14, background: '#a3e635', borderRadius: 3, opacity: 0.9 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>alex_k</span>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(163,230,53,0.12)', border: '0.5px solid rgba(163,230,53,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#a3e635',
        }}>A</div>
      </div>
    </div>

    <div style={{ padding: 14 }}>
      {/* hero stats card */}
      <div style={{
        background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 110, height: 110,
          background: '#a3e635', borderRadius: '50%', opacity: 0.06,
        }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([['3.84', 'DUPR', false], ['31', 'Wins', true], ['47', 'Matches', false]] as [string, string, boolean][]).map(([val, lbl, accent]) => (
            <div key={lbl} style={{
              flex: 1, borderRadius: 8, padding: '8px 10px', textAlign: 'center',
              background: accent ? 'rgba(132,204,22,0.1)' : 'rgba(255,255,255,0.06)',
              border: accent ? '0.5px solid rgba(132,204,22,0.2)' : 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: accent ? '#a3e635' : '#fff' }}>{val}</div>
              <div style={{ fontSize: 9, color: accent ? 'rgba(163,230,53,0.5)' : 'rgba(255,255,255,0.35)', marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            background: '#fff', color: '#111', fontSize: 10, fontWeight: 500,
            padding: '6px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <RefreshCw size={10} /> Refresh rewards
          </div>
        </div>
      </div>

      {/* rewards catalog label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: '#a3e635' }}>🏆</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>Rewards catalog</span>
      </div>

      {/* reward cards row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          { brand: 'CRBN', name: '10% off site wide', wins: '5 wins', bg: 'linear-gradient(135deg,#1e3a1e,#2d5a27)', locked: false },
          { brand: 'Diadem', name: '20% off bags', wins: '10 wins', bg: 'linear-gradient(135deg,#1a2a3a,#0e3a5a)', locked: false },
          { brand: 'Pulse', name: '20% off balls', wins: '25 wins', bg: 'linear-gradient(135deg,#2a1a2a,#3d1f3d)', locked: true },
        ]).map(({ brand, name, wins, bg, locked }) => (
          <div key={brand} style={{
            borderRadius: 10, overflow: 'hidden', flexShrink: 0, width: 110,
            border: '0.5px solid rgba(255,255,255,0.08)', background: '#1a1a1a',
            opacity: locked ? 0.45 : 1, filter: locked ? 'grayscale(1)' : 'none',
          }}>
            <div style={{ height: 66, background: bg, position: 'relative', padding: 6, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 20%,rgba(0,0,0,0.7))' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{brand}</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#fff', lineHeight: 1.2 }}>{name}</div>
              </div>
            </div>
            <div style={{ padding: 7 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>{wins}</div>
              {locked ? (
                <div style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px dashed rgba(255,255,255,0.12)',
                  borderRadius: 5, padding: '3px 0', textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)',
                }}>Locked</div>
              ) : (
                <div style={{
                  background: '#a3e635', borderRadius: 5, padding: '3px 0',
                  textAlign: 'center', fontSize: 9, fontWeight: 500, color: '#0f0f0f',
                }}>Claim</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* recent matches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: '#a3e635' }}>⏱</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>Recent matches</span>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '10px 12px' }}>
        {([
          ['Round robin', 'Mon 5/19', true],
          ['League night', 'Wed 5/14', true],
          ['Tournament', 'Sat 5/10', false],
        ] as [string, string, boolean][]).map(([name, date, win]) => (
          <div key={date} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
          }}>
            <span>{name}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{date}</span>
            <span style={{
              fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
              background: win ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.12)',
              color: win ? '#84cc16' : '#f87171',
            }}>{win ? 'W' : 'L'}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const BrandScreen = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {/* dashboard panel */}
    <div style={{
      background: '#f8fafc', borderRadius: 16,
      border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden',
      boxShadow: '0 16px 40px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.85)', borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>Dashboard</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.2)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#16a34a', fontWeight: 500 }}>✓ Shopify Active</div>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['Players engaged', '284'], ['Rewards issued', '61']].map(([lbl, val]) => (
            <div key={lbl} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#0f172a' }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 7 }}>Reward log</div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
          {([
            ['MR', 'Maya R.', 'GG-WIN10', true],
            ['TK', 'Tom K.', 'GG-WIN10', false],
            ['SL', 'Sara L.', 'GG-WIN25', true],
          ] as [string, string, string, boolean][]).map(([init, name, code, redeemed]) => (
            <div key={init} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: '#475569' }}>{init}</div>
                <span style={{ color: '#0f172a' }}>{name}</span>
              </div>
              <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 10, flex: 1 }}>{code}</span>
              <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: redeemed ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: redeemed ? '#16a34a' : '#d97706' }}>
                {redeemed ? 'Redeemed' : 'Active'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* billing panel */}
    <div style={{
      background: '#f8fafc', borderRadius: 16,
      border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden',
      boxShadow: '0 16px 40px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.85)', borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>Billing</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[['Total charged', '$92.10', '#16a34a'], ['Upcoming', '$18.50', '#0f172a']].map(([lbl, val, col]) => (
            <div key={lbl} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: col }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
          {([
            ['#4821', 'GG-WIN10', '$74.00', '$3.70', 'charged'],
            ['#4820', 'GG-WIN25', '$120.00', '$6.00', 'pending'],
            ['#4819', 'GG-WIN10', '$55.00', '$2.75', 'held'],
          ] as [string, string, string, string, string][]).map(([order, code, sale, comm, status]) => (
            <div key={order} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)', fontSize: 11 }}>
              <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>{order}</span>
              <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }}>{code}</span>
              <span style={{ color: '#0f172a' }}>{sale}</span>
              <span style={{ color: '#64748b' }}>→ {comm}</span>
              <span style={{
                fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
                background: status === 'charged' ? 'rgba(34,197,94,0.1)' : status === 'held' ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)',
                color: status === 'charged' ? '#16a34a' : status === 'held' ? '#d97706' : '#6b7280',
              }}>
                {status === 'charged' ? 'Charged' : status === 'held' ? 'On hold' : 'Upcoming'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tournament showcase card (new — public, no DUPR references, Section 5.2/6)
// Each card is a placeholder for a real, GG-partnered tournament and should
// link out to that tournament's own external registration page once wired
// to real data.
// ─────────────────────────────────────────────────────────────────────────────

type Tournament = {
  name: string;
  location: string;
  dateLabel: string;
  venue: string;
  gradient: string;
  href: string;
};

// Sample data — swap for a real tournaments feed/API when available.
const tournaments: Tournament[] = [
  { name: '4x4 Summer Smash', location: 'Fountain Valley, CA', venue: 'AGAPE Tennis Academy', dateLabel: 'August 22nd', gradient: 'linear-gradient(135deg,#609FDD,#0e3a5a)', href: 'https://www.tpaevents.com/booking-tourney' },
];

{/*}
const tournaments: Tournament[] = [
  { name: 'Westside Fall Slam', location: 'Los Angeles, CA', venue: 'Rewards from Pulse & Hydro', dateLabel: 'Oct 4–5', gradient: 'linear-gradient(135deg,#76D775,#2d5a27)', href: '#' },
  { name: 'Coastal Doubles Classic', location: 'San Diego, CA', venue: 'Rewards from Pulse & Hydro', dateLabel: 'Oct 18', gradient: 'linear-gradient(135deg,#609FDD,#0e3a5a)', href: '#' },
  { name: 'Rocky Mountain Open', location: 'Denver, CO', venue: 'Rewards from Pulse & Hydro',dateLabel: 'Nov 1–2', gradient: 'linear-gradient(135deg,#E76EE7,#3d1f3d)', href: '#' },
  { name: 'Sunbelt Showdown', location: 'Austin, TX', venue: 'Rewards from Pulse & Hydro',dateLabel: 'Nov 15', gradient: 'linear-gradient(135deg,#E29E5B,#5a3a0e)', href: '#' },
];
*/}

const TournamentCard = ({ name, location, dateLabel, venue, gradient, href }: Tournament) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
    <div style={{
      background: '#111', borderRadius: 14, overflow: 'hidden', height: '100%',
      border: '0.5px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ height: 92, background: gradient, position: 'relative', padding: 12, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75))' }} />
        <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{dateLabel}</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 3 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{location}</div>
        <div style={{ fontSize: 11, color: 'rgb(168 255 26)', marginBottom: 10 }}>{venue}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          View tournament <ExternalLink size={11} />
        </div>
      </div>
    </div>
  </a>
);

// ─────────────────────────────────────────────────────────────────────────────
// Reusable two-column audience section
// ─────────────────────────────────────────────────────────────────────────────

type AudienceSectionProps = {
  tag: string;
  eyebrow: string;
  titleLine1: string;
  titleAccent: string;
  titleLine2?: string;
  body: string;
  checks: string[];
  screen: React.ReactNode;
  screenRight?: boolean;
  dark?: boolean;
  extraContent?: React.ReactNode;
};

const AudienceSection = ({
  tag, eyebrow, titleLine1, titleAccent, titleLine2,
  body, checks, screen, screenRight = false, dark = false, extraContent,
}: AudienceSectionProps) => {
  const textCol = (
    <Flex direction="column" justify="center" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <Badge
        radius="full"
        size="1"
        mb="4"
        style={{
          background: 'rgba(163,230,53,0.8)',
          border: '0.5px solid rgba(163,230,53,0.25)',
          color: '#000000',
          fontWeight: 500,
          letterSpacing: '0.08em',
          alignSelf: 'flex-start',
          padding: '4px 12px',
        }}
      >
        {tag}
      </Badge>

      <Text
        size="1"
        weight="bold"
        mb="2"
        style={{ color: 'green', letterSpacing: '0.12em', textTransform: 'uppercase' }}
      >
        {eyebrow}
      </Text>

      <Heading
        size="7"
        mb="4"
        style={{
          color: dark ? '#fff' : 'var(--slate-12)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}
      >
        {titleLine1}
        <br />
        <span className={styles.heroTextGradient}>{titleAccent}</span>
        {titleLine2 && <><br />{titleLine2}</>}
      </Heading>

      <Text
        size="3"
        mb="5"
        style={{ color: dark ? '#FFFFFF' : 'var(--slate-11)', lineHeight: 1.7, maxWidth: 480 }}
      >
        {body}
      </Text>

      <Flex direction="column" gap="2" mb={extraContent ? '5' : '0'}>
        {checks.map((c) => (
          <Flex key={c} align="center" gap="2">
            <Check size={15} strokeWidth={3} color="#84cc16" style={{ flexShrink: 0 }} />
            <Text size="2" style={{ color: dark ? 'rgba(255,255,255,0.8)' : 'var(--slate-11)' }}>{c}</Text>
          </Flex>
        ))}
      </Flex>

      {extraContent}
    </Flex>
  );

  const screenCol = <Box style={{ minWidth: 0 }}>{screen}</Box>;

  return (
    <Grid columns={{ initial: '1', md: '2' }} gap="8" align="center">
      {screenRight ? textCol : screenCol}
      {screenRight ? screenCol : textCol}
    </Grid>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FAQ item (preserved exactly from original)
// ─────────────────────────────────────────────────────────────────────────────

const FaqItem = ({
  question, answer, isOpen, onToggle, dark = false,
}: {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  dark?: boolean;
}) => (
  <Box style={{
    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--slate-4)'}`,
    paddingTop: 20, paddingBottom: 20,
  }}>
    <button
      onClick={onToggle}
      style={{
        all: 'unset', cursor: 'pointer', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}
      aria-expanded={isOpen}
    >
      <Text size="4" weight="bold" style={{ color: dark ? '#fff' : 'var(--slate-12)' }}>{question}</Text>
      <Flex align="center" justify="center" style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        transition: 'background-color 0.2s ease',
        backgroundColor: isOpen ? 'var(--lime-9)' : dark ? 'rgba(255,255,255,0.08)' : 'var(--slate-3)',
        color: isOpen ? '#0a0a0a' : dark ? 'rgba(255,255,255,0.6)' : 'var(--slate-11)',
      }}>
        {isOpen ? <Minus size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
      </Flex>
    </button>
    {isOpen && (
      <Box pt="3" pr="8">
        <Text size="3" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate-11)', lineHeight: 1.7 }}>{answer}</Text>
      </Box>
    )}
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Billing extra content — switches on NEXT_PUBLIC_SHOPIFY_APP_MODE
// (Unchanged — brand partner functionality is unaffected by the pivot)
// ─────────────────────────────────────────────────────────────────────────────

const isCustomApp = process.env.NEXT_PUBLIC_SHOPIFY_APP_MODE === 'custom';

const BrandBillingCard = isCustomApp ? (
  // ── Custom app mode: performance-based billing via Stripe ──
  <Card style={{ background: 'var(--slate-1)', border: '1px solid var(--slate-4)', padding: 20, marginTop: 8 }}>
    <Flex justify="between" align="center" mb="3">
      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>No upfront cost</Text>
      <Badge color="green" variant="soft" radius="full">✓ Pay on performance</Badge>
    </Flex>
    <Text size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.65, display: 'block', marginBottom: 12 }}>
      You only pay a 5% commission when a GG Pickleball referral turns into a real sale.
      No monthly fee, no ad spend, no risk. Returns within 30 days are automatically
      factored in. You're never charged on money you didn't keep.
    </Text>
    <Grid columns="2" gap="2">
      {[
        'No monthly fee or setup cost',
        '5% commission on net sales only',
        'Full returns within 30 days waive the fee',
        'Partial refunds reduce the commission proportionally',
      ].map((label) => (
        <Flex key={label} align="center" gap="2" style={{
          background: 'var(--slate-2)', borderRadius: 8, padding: '8px 10px',
          border: '1px solid var(--slate-3)',
        }}>
          <Check size={13} strokeWidth={3} color="#84cc16" style={{ flexShrink: 0 }} />
          <Text size="1" style={{ color: 'var(--slate-11)' }}>{label}</Text>
        </Flex>
      ))}
    </Grid>
  </Card>
) : (
  // ── Public app mode: billing managed by Shopify ──
  <Card style={{ background: 'var(--slate-1)', border: '1px solid var(--slate-4)', padding: 20, marginTop: 8 }}>
    <Flex justify="between" align="center" mb="3">
      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>Billing via Shopify</Text>
      <Badge color="green" variant="soft" radius="full">✓ Managed by Shopify</Badge>
    </Flex>
    <Text size="2" style={{ color: 'var(--slate-11)', lineHeight: 1.65, display: 'block', marginBottom: 12 }}>
      Commissions bill automatically through your Shopify subscription — 30 days after each order.
      Returns and disputes are evaluated before any charge is made. No separate payment method needed.
    </Text>
    <Grid columns="2" gap="2">
      {[
        'One invoice per billing cycle',
        'Returns auto-adjust the fee',
        'Disputes waive the charge',
        'No separate payment setup',
      ].map((label) => (
        <Flex key={label} align="center" gap="2" style={{
          background: 'var(--slate-2)', borderRadius: 8, padding: '8px 10px',
          border: '1px solid var(--slate-3)',
        }}>
          <Check size={13} strokeWidth={3} color="#84cc16" style={{ flexShrink: 0 }} />
          <Text size="1" style={{ color: 'var(--slate-11)' }}>{label}</Text>
        </Flex>
      ))}
    </Grid>
  </Card>
);

// Checklist items also vary by mode
const brandChecks = isCustomApp
  ? [
      'Audience verified by official match data, not self-reported.',
      '5% commission on net sales only. Zero upfront cost.',
      'Connect your existing Shopify store in minutes.',
      'See who earned, who redeemed, and what converted.',
    ]
  : [
      'Audience verified by official match data, not self-reported.',
      '5% commission on net sales. Waived on returns.',
      'Connect your existing Shopify store in minutes.',
      'See who earned, who redeemed, and what converted.',
    ];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  const { isLoading: auth0IsLoading } = useAuth0User();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Preserved exactly from original
  if (auth0IsLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  // Rewritten for the tournament pivot — no public DUPR mentions (Section 6),
  // no references to self-signup (Section 9 item 1 — signup is disabled)
  const faqs = [
    {
      question: 'Is GG Pickleball really free?',
      answer: 'Yes. No subscriptions, no credit card, no hidden fees. Brands sponsor the rewards because they want to reach active players. You play in tournaments we partner with, we track the results, and you unlock perks along the way. Everyone wins.',
    },
    {
      question: 'How do my matches get counted?',
      answer: "GG partners directly with tournament organizers. After an event wraps, official results are uploaded and matched to your account. If you've played in a partnered tournament, your account is already waiting. Just log in to see what you've earned.",
    },
    {
      question: 'What kind of rewards can I actually earn?',
      answer: 'Discounts on paddles and gear, free merch, and exclusive offers from brands you already love. The more you play, the more you unlock.',
    }
  ];

  return (
    <Box style={{ backgroundColor: '#ffffff' }}>

      {/* ============ HERO ============ */}
      {/* Structure/orbs/grid texture preserved from original — copy and primary CTA updated */}
      <Box style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0a0a0a', minHeight: '92vh' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }} />
        <Box style={{
          position: 'absolute', top: '50%', right: '-10%', transform: 'translateY(-50%)',
          width: '70vw', maxWidth: 900, height: '70vw', maxHeight: 900,
          borderRadius: '50%', pointerEvents: 'none', zIndex: 2,
          background: 'radial-gradient(circle at center, rgba(178,255,0,0.35) 0%, rgba(178,255,0,0.12) 25%, rgba(178,255,0,0.03) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <Box style={{
          position: 'absolute', top: '30%', right: '5%', width: 400, height: 400,
          borderRadius: '50%', pointerEvents: 'none', zIndex: 2,
          background: 'radial-gradient(circle at center, rgba(178,255,0,0.25) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }} />

        <Container size="4" px="5" style={{ position: 'relative', zIndex: 10 }}>
          <Flex justify={{initial: 'center', md: 'between'}} align="center" pt="9" mb="6">
            <Badge color="lime" variant="soft" size="2" radius="full" className={styles.fadeIn} style={{
              border: '1px solid var(--lime-a6)',
              backgroundColor: 'rgba(178, 255, 0, 0.08)',
              padding: '6px 14px',
            }}>
              <Flex align="center" gap="2">
                <Box style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#b2ff00', boxShadow: '0 0 8px #b2ff00' }} />
                <Text size="2" style={{ color: '#b2ff00', letterSpacing: '0.02em' }}>
                  Rewards built for pickleball players
                </Text>
              </Flex>
            </Badge>
            {/* Preserved: /auth/login?returnTo=/play — still the correct entry point for existing/claimed accounts */}
            <Flex display={{initial: 'none', md: 'flex'}}>
              <Button  asChild variant="solid" size="3" radius="full" color="lime">
                <Link  href="/auth/login?returnTo=/api/auth/redirect">Access your account</Link>
              </Button>
            </Flex>
            
          </Flex>

          <Flex align="center" style={{ minHeight: '80vh' }} pb="9">
            <Box style={{ maxWidth: 900 }}>
              <Heading
                as="h1"
                weight="bold"
                mb="5"
                className={styles.slideUp}
                align={{ initial: 'center', md: 'left' }}
                style={{ color: '#FFFFFF', fontSize: 'clamp(56px, 9vw, 120px)', lineHeight: 0.92, letterSpacing: '-0.035em' }}
              >
                Pickleball
                <br />
                <span className={styles.heroTextGradient}>Rewarded.</span>
              </Heading>

              <Text as="p" size="5" mb="7" align={{ initial: 'center', md: 'left' }} className={styles.slideUp}
                style={{ color: 'rgba(255,255,255,0.72)', animationDelay: '0.2s', lineHeight: 1.55, maxWidth: 620 }}
              >
                GG Pickleball partners with tournaments across the country to turn every
                match you play into exclusive rewards from the brands shaping the sport.
              </Text>

              <Flex gap="3" direction={{ initial: 'column', xs: 'row' }} className={styles.slideUp} style={{ animationDelay: '0.4s' }}>
                {/* Updated: no self-signup exists (Section 9 item 1) — primary action is discovery, not signup */}
                <Button asChild size="4" radius="full" color="lime">
                  <Link href="#tournaments">
                    <Flex align="center" gap="2">
                      See participating tournaments
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </Flex>
                  </Link>
                </Button>
                {/* Preserved: /apply */}
                <Button asChild size="4" radius="full" variant="outline" color="lime" highContrast
                  style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,1)' }}
                >
                  <Link href="/apply">Feature your brand</Link>
                </Button>
              </Flex>

              <Flex gap="5" mt="7" wrap="wrap" justify={{ initial: 'center', md: 'start' }} className={styles.slideUp} style={{ animationDelay: '0.6s' }}>
                {['Free forever', 'No credit card', 'Verified tournament results'].map((label) => (
                  <Flex key={label} align="center" gap="2">
                    <Check size={16} strokeWidth={3} color="#b2ff00" />
                    <Text size="2" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* ============ TOURNAMENTS SECTION (new) ============ */}
      {/* Public-facing tournament showcase — Section 5.2 pattern, no DUPR mentions (Section 6). */}
      {/* Sample data below; wire up to a real tournaments feed when available. */}
      <Box id="tournaments" py="9" style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="4" px="5">
          <Flex direction="column" align="center" mb="8">
            <Text size="2" weight="bold" mb="3" style={{ color: '#84cc16', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Now playing
            </Text>
            <Heading size="9" align="center" mb="4" style={{ maxWidth: 720, letterSpacing: '-0.02em', lineHeight: 1.05, color: '#fff' }}>
              Play here. Get rewarded.
            </Heading>
            <Text size="4" align="center" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 560, lineHeight: 1.6 }}>
              GG Pickleball partners with tournaments across the country. Play in one of these
              events and any rewards you've earned will be waiting when you log in.
            </Text>
          </Flex>

          <Grid columns={{ initial: '1', xs: '2', md: '4' }} gap="4" mb="7">
            {tournaments.map((t) => <TournamentCard key={t.name} {...t} />)}
          </Grid>

          {/* Lightweight organizer callout — replaces the old full "Clubs & Organizers" section */}
          <Flex
            justify="between" align="center" gap="4" wrap="wrap"
            p="5"
            style={{ background: 'rgba(163,230,53,0.05)', border: '0.5px solid rgba(163,230,53,0.2)', borderRadius: 14 }}
          >
            <Box>
              <Text size="4" weight="bold" style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                Running a tournament?
              </Text>
              <Text size="2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Partner with GG Pickleball and increase the available prize pool for your players at no additional cost.
              </Text>
            </Box>
            {/* Placeholder mailto — replace with a real intake form/route when one exists */}
            <Button asChild size="3" radius="full" color="lime">
              <Link href="/tournaments/apply">
                <Flex align="center" gap="2">
                  Partner with us
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Flex>
              </Link>
            </Button>
          </Flex>
        </Container>
      </Box>

      {/* ============ PLAYERS SECTION ============ */}
      <Box py="9" style={{ backgroundColor: '#292929', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="4" px="5">
          <AudienceSection
            tag="For players"
            eyebrow="Your wins. Your rewards."
            titleLine1="Every match you play"
            titleAccent="gets you closer to earning."
            body="Play in a GG-partnered tournament and we'll take care of the rest. Once results are in, your wins automatically count toward rewards from the brands you already love."
            checks={[
              'Results come straight from tournament organizers',
              'Rewards unlock the moment you hit a milestone',
              'Free forever, no credit card required',
            ]}
            screen={<PlayerScreen />}
            screenRight
            dark
          />
        </Container>
      </Box>

      {/* ============ BRANDS SECTION ============ */}
      {/* Unchanged — brand partner functionality is unaffected by the pivot (Section 7) */}
      <Box py="9" style={{ backgroundColor: '#ffffff', borderTop: '1px solid var(--slate-4)' }}>
        <Container size="4" px="5">
          <AudienceSection
            tag="For brands"
            eyebrow="Performance-based reach."
            titleLine1="Reach players who are"
            titleAccent="actively competing."
            body="GG connects your Shopify store to a verified player base. You set the discount, we surface it the moment a player earns it. You only pay a 5% commission on actual sales. No ad spend, no guesswork."
            checks={brandChecks}
            screen={<BrandScreen />}
            screenRight
            extraContent={BrandBillingCard}
          />
        </Container>
      </Box>

      {/* ============ HOW IT WORKS ============ */}
      <Box py="9" style={{ backgroundColor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="4" px="5">
          <Flex direction="column" align="center" mb="9">
            <Text size="2" weight="bold" mb="3" style={{ color: '#84cc16', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              How it works
            </Text>
            <Heading size="9" align="center" mb="4" style={{ maxWidth: 720, letterSpacing: '-0.02em', lineHeight: 1.05, color: '#fff' }}>
              Three steps. Zero effort.
            </Heading>
          </Flex>

          <Grid columns={{ initial: '1', md: '3' }} gap="0" style={{ borderRadius: 16, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            {[
              {
                icon: <Zap size={22} strokeWidth={2} />,
                eyebrow: 'Step 01',
                title: 'Play in a partnered tournament',
                description: 'Register through the tournament organizer and play like you always do. Nothing extra to set up.',
              },
              {
                icon: <RefreshCw size={22} strokeWidth={2} />,
                eyebrow: 'Step 02',
                title: 'We upload your results',
                description: 'After the event, official match results are uploaded and matched to your account automatically.',
              },
              {
                icon: <Sparkles size={22} strokeWidth={2} />,
                eyebrow: 'Step 03',
                title: 'Unlock rewards',
                description: "Log in to see what you've unlocked: discounts, free gear, and exclusive offers from the brands you already love.",
              },
            ].map(({ icon, eyebrow, title, description }, i) => (
              <Box key={title} p="6" style={{
                background: i === 1 ? 'rgba(163,230,53,0.04)' : 'rgba(255,255,255,0.02)',
                borderRight: i < 2 ? '0.5px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <Flex align="center" justify="center" mb="4" style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(163,230,53,0.1)',
                  border: '0.5px solid rgba(163,230,53,0.2)',
                  color: '#a3e635',
                }}>
                  {icon}
                </Flex>
                <Text size="1" weight="bold" mb="2" style={{ display: 'block', color: '#84cc16', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {eyebrow}
                </Text>
                <Heading as="h3" size="5" mb="2" style={{ color: '#fff', letterSpacing: '-0.01em' }}>{title}</Heading>
                <Text size="3" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{description}</Text>
              </Box>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ============ FAQ ============ */}
      <Box py="9" style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="3" px="5">
          <Flex direction="column" align="center" mb="8">
            <Text size="2" weight="bold" mb="3" style={{ color: '#84cc16', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              FAQ
            </Text>
            <Heading size="9" align="center" style={{ letterSpacing: '-0.02em', lineHeight: 1.05, color: '#fff' }}>
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
                dark
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ============ FINAL CTA ============ */}
      <Box py="9" style={{ backgroundColor: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
        }} />
        <Container size="3" px="5" style={{ position: 'relative', zIndex: 1 }}>
          <Flex direction="column" align="center" gap="5">
            <Heading size="9" align="center" style={{ color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.05, maxWidth: 720 }}>
              Your next match is worth <span className={styles.heroTextGradient}>more</span>.
            </Heading>
            <Text size="5" align="center" style={{ color: 'rgba(255,255,255,0.72)', maxWidth: 520 }}>
              Find a partnered tournament and start unlocking rewards from the brands you love.
            </Text>
            <Button asChild size="4" radius="full" color="lime" mt="2">
              <Link href="#tournaments">
                <Flex align="center" gap="2">
                  See participating tournaments
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Flex>
              </Link>
            </Button>
          </Flex>
        </Container>
      </Box>

      {/* ============ FOOTER ============ */}
      {/* Preserved structure — added an organizer contact link alongside the existing ones */}
      <Box py="6" style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid var(--slate-12)' }}>
        <Container size="4" px="5">
          <Flex justify="between" align="center" direction={{ initial: 'column', sm: 'row' }} gap="4">
            <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              &copy; {new Date().getFullYear()} GG Pickleball. All rights reserved.
            </Text>
            <Flex gap="5">
              <Link href="/apply" style={{ textDecoration: 'none' }}>
                <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>Feature your brand</Text>
              </Link>
               <Link href="/programs/apply">
                  <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>Partner your program or tournament</Text>
              </Link>
              <Link href="mailto:play@ggpickleball.co" style={{ textDecoration: 'none' }}>
                <Text size="2" style={{ color: 'rgba(255,255,255,0.5)' }}>Contact</Text>
              </Link>
            </Flex>
          </Flex>
        </Container>
      </Box>

    </Box>
  );
}