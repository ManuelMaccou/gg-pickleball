'use client';

import React, { useState } from 'react';
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
          { brand: 'Selkirk', name: '15% off paddles', wins: '10 wins', bg: 'linear-gradient(135deg,#1e3a1e,#2d5a27)', locked: false },
          { brand: 'Hydrant', name: 'Free starter pack', wins: '10 wins', bg: 'linear-gradient(135deg,#1a2a3a,#0e3a5a)', locked: false },
          { brand: 'Franklin', name: '20% off balls', wins: '25 wins', bg: 'linear-gradient(135deg,#2a1a2a,#3d1f3d)', locked: true },
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

const ClubScreen = () => (
  <div style={{
    background: '#111',
    borderRadius: 16,
    border: '0.5px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
  }}>
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
        <span>Clubs</span>
        <span style={{ opacity: 0.4 }}>›</span>
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>Tuesday Round Robin</span>
      </div>
      <div style={{
        background: '#a3e635', color: '#0f0f0f', fontSize: 10, fontWeight: 500,
        padding: '4px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        ↑ Submit to DUPR
      </div>
    </div>

    <div style={{ padding: 14 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Tuesday Round Robin</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>May 20, 2026 · 12 players · Westside PB Club</div>
      </div>

      {/* match card */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Match 1 · Doubles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 14px 1fr', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Team A</div>
            {[['AK', 'Alex K.', '#a3e635'], ['JM', 'Jordan M.', '#a3e635']].map(([init, name, col]) => (
              <div key={init} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: col, flexShrink: 0 }}>{init}</div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{name}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>vs</div>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Team B</div>
            {[['RL', 'Ryan L.', 'rgba(255,255,255,0.4)'], ['SP', 'Sam P.', 'rgba(255,255,255,0.4)']].map(([init, name, col]) => (
              <div key={init} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: col, flexShrink: 0 }}>{init}</div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ background: 'rgba(132,204,22,0.12)', border: '0.5px solid rgba(132,204,22,0.25)', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 500, color: '#a3e635' }}>11</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>—</div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>7</div>
          <div style={{ marginLeft: 'auto', background: 'rgba(132,204,22,0.1)', border: '0.5px solid rgba(132,204,22,0.2)', borderRadius: 5, padding: '2px 7px' }}>
            <span style={{ fontSize: 9, color: '#a3e635' }}>✓ Submitted</span>
          </div>
        </div>
      </div>

      {/* sync status */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Player sync status</div>
        {([
          ['AK', 'Alex K.', 'synced'],
          ['JM', 'Jordan M.', 'synced'],
          ['RL', 'Ryan L.', 'pending'],
          ['SP', 'Sam P.', 'nodupr'],
        ] as [string, string, string][]).map(([init, name, status]) => (
          <div key={init} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: status === 'synced' ? '#a3e635' : 'rgba(255,255,255,0.4)' }}>{init}</div>
            <span style={{ flex: 1 }}>{name}</span>
            <span style={{
              fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
              background: status === 'synced' ? 'rgba(132,204,22,0.1)' : status === 'nodupr' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
              color: status === 'synced' ? '#84cc16' : status === 'nodupr' ? '#f59e0b' : 'rgba(255,255,255,0.35)',
            }}>
              {status === 'synced' ? '✓ Synced' : status === 'nodupr' ? '⚠ No DUPR' : '⏱ Pending'}
            </span>
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
          <div style={{ background: '#f1f5f9', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#64748b' }}>Selkirk Sport</div>
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
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.2)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Managed by Shopify</div>
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
          background: 'rgba(163,230,53,0.08)',
          border: '0.5px solid rgba(163,230,53,0.25)',
          color: '#84cc16',
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
        style={{ color: 'var(--lime-11)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
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
        style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate-11)', lineHeight: 1.7, maxWidth: 480 }}
      >
        {body}
      </Text>

      <Flex direction="column" gap="2" mb={extraContent ? '5' : '0'}>
        {checks.map((c) => (
          <Flex key={c} align="center" gap="2">
            <Check size={15} strokeWidth={3} color="#84cc16" style={{ flexShrink: 0 }} />
            <Text size="2" style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate-11)' }}>{c}</Text>
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
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
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

  // Preserved exactly from original
  const faqs = [
    {
      question: 'Is GG Pickleball really free?',
      answer: "Yes — completely. No subscriptions, no credit card, no hidden fees. Brands sponsor the rewards because they want to reach active players. You play, we sync your matches, they get exposure to a passionate community. Everyone wins.",
    },
    {
      question: 'How does the DUPR sync work?',
      answer: 'Connect your DUPR account once and GG Pickleball pulls in your match history. You never have to manually log a game, upload a screenshot, or report a score. New matches show up, rewards update — all in the background.',
    },
    {
      question: 'What kind of rewards can I actually earn?',
      answer: 'Discounts on paddles and gear, free merch, and exclusive offers from brands you already love. The more you play, the more you unlock.',
    },
    {
      question: 'Do I need to play at a specific club?',
      answer: "No. As long as your matches are recorded in DUPR, they count — whether you're at a tournament or a league night.",
    },
    {
      question: 'What happens to my data?',
      answer: 'We only read your DUPR match history to power your rewards. We never sell your data, and you can disconnect or delete your account at any time.',
    },
  ];

  return (
    <Box style={{ backgroundColor: '#ffffff' }}>

      {/* ============ HERO ============ */}
      {/* Preserved exactly from original — all styles, orbs, grid texture, classes, links */}
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
          <Flex justify="between" align="center" pt="9" mb="6">
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
            {/* Preserved: /auth/login?returnTo=/play */}
            <Button asChild variant="solid" size="3" radius="full" color="lime">
              <Link href="/auth/login?returnTo=/play">Access your account</Link>
            </Button>
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
                GG Pickleball syncs with your DUPR account to automatically turn every match
                you play into exclusive rewards from the brands shaping the sport.
              </Text>

              <Flex gap="3" direction={{ initial: 'column', xs: 'row' }} className={styles.slideUp} style={{ animationDelay: '0.4s' }}>
                {/* Preserved: /auth/login?screen_hint=signup&returnTo=/play */}
                <Button asChild size="4" radius="full" color="lime">
                  <Link href="/auth/login?screen_hint=signup&returnTo=/play">
                    <Flex align="center" gap="2">
                      Sign up free
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
                {['Free forever', 'No credit card', 'Syncs with DUPR'].map((label) => (
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

      {/* ============ PLAYERS SECTION ============ */}
      <Box py="9" style={{ backgroundColor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="4" px="5">
          <AudienceSection
            tag="For players"
            eyebrow="Your wins. Your rewards."
            titleLine1="Every match you play"
            titleAccent="earns you something."
            body="Connect your DUPR account once and GG automatically turns your wins into exclusive discounts and free gear from top pickleball brands. No manual entry, no screenshots. Just play."
            checks={[
              'Syncs automatically with your DUPR match history',
              'Rewards unlock the moment you hit a milestone',
              'Unlocked codes are yours to keep — no expiry',
              'Free forever, no credit card required',
            ]}
            screen={<PlayerScreen />}
            screenRight
            dark
          />
        </Container>
      </Box>

      {/* ============ CLUBS SECTION ============ */}
      <Box py="9" style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Container size="4" px="5">
          <AudienceSection
            tag="For clubs & organizers"
            eyebrow="Run leagues. Run tournaments."
            titleLine1="Your events fuel"
            titleAccent="your players' rewards."
            body="Club admins upload match results directly to DUPR from GG. When players sync, those wins count toward their milestones automatically — turning every league night into a rewards moment for your whole community."
            checks={[
              'Bulk upload singles and doubles match results',
              'See per-player DUPR sync status in real time',
              'Works for leagues, round robins, and tournaments',
              'Players without DUPR are flagged so you can invite them',
            ]}
            screen={<ClubScreen />}
            dark
          />
        </Container>
      </Box>

      {/* ============ BRANDS SECTION ============ */}
      <Box py="9" style={{ backgroundColor: '#ffffff', borderTop: '1px solid var(--slate-4)' }}>
        <Container size="4" px="5">
          <AudienceSection
            tag="For brands"
            eyebrow="Performance-based reach."
            titleLine1="Reach players who are"
            titleAccent="actively competing."
            body="GG connects your Shopify store to a DUPR-verified player base. You set the discount, we surface it the moment a player earns it. You only pay a 5% commission on actual sales — no ad spend, no guesswork."
            checks={[
              'Audience verified by DUPR match data, not self-reported',
              '5% commission on net sales — waived on returns',
              'Connect your existing Shopify store in minutes',
              'See who earned, who redeemed, and what converted',
            ]}
            screen={<BrandScreen />}
            screenRight
            extraContent={
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
            }
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
            <Text size="5" align="center" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 560 }}>
              You sweat on the court. Every win is verified by DUPR — not self-reported. Everything else happens automatically.
            </Text>
          </Flex>

          <Grid columns={{ initial: '1', md: '3' }} gap="0" style={{ borderRadius: 16, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            {[
              {
                icon: <RefreshCw size={22} strokeWidth={2} />,
                eyebrow: 'Step 01',
                title: 'Connect your DUPR',
                description: 'Link your DUPR account and pull in your match history automatically — no manual reporting, no screenshots, no spreadsheets.',
              },
              {
                icon: <Zap size={22} strokeWidth={2} />,
                eyebrow: 'Step 02',
                title: 'Play your matches',
                description: 'Keep playing the way you already do. Leagues, tournaments, club nights — every DUPR-recorded match counts toward your rewards.',
              },
              {
                icon: <Sparkles size={22} strokeWidth={2} />,
                eyebrow: 'Step 03',
                title: 'Unlock rewards',
                description: 'Earn perks from your favorite brands and discover new ones. Discounts, free gear, exclusive offers — all unlocked just by playing.',
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
      {/* Preserved exactly from original */}
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
              Sign up free, sync your DUPR, and start unlocking rewards from the brands you love.
            </Text>
            {/* Preserved: /auth/login?returnTo=/play */}
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
      {/* Preserved exactly from original — copyright year, /apply, mailto links */}
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