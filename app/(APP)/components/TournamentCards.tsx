'use client';

// Destination: components/sections/TournamentCards.tsx
//
// Deliberately lean — just the tournament data, the individual card, and
// the grid that lays them out. No marketing header, no organizer callout —
// those are page-specific and stay inline wherever this is used (see
// HomePage.tsx for the home page's own wrapping). This is meant to be a
// drop-in grid that inherits whatever background/spacing its parent
// provides, not a self-contained "section."

import { ExternalLink } from 'lucide-react';
import { Grid } from '@radix-ui/themes';

export type Tournament = {
  name: string;
  location: string;
  venue: string;
  dateLabel: string;
  gradient: string;
  href: string;
};

// Sample data — swap for a real tournaments feed/API when available.
export const tournaments: Tournament[] = [
  { name: '4x4 Summer Smash', location: 'Fountain Valley, CA', venue: 'Fountain Valley Tennis and Pickleball Center', dateLabel: 'August 22nd', gradient: 'linear-gradient(135deg,#609FDD,#0e3a5a)', href: 'https://www.tpaevents.com/booking-tourney' },
];

export const TournamentCard = ({ name, location, venue, dateLabel, gradient, href }: Tournament) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
    <div style={{
      background: '#111', borderRadius: 14, overflow: 'hidden', height: '100%',
      border: '0.5px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ height: 92, background: gradient, position: 'relative', padding: 12, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75))' }} />
        <div style={{ position: 'relative', zIndex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{dateLabel}</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', marginBottom: 3 }}>{name}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{location}</div>
        <div style={{ fontSize: 14, color: 'rgb(168 255 26)', marginBottom: 10 }}>{venue}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          View tournament <ExternalLink size={11} />
        </div>
      </div>
    </div>
  </a>
);

export interface TournamentCardsProps {
  // Optional — defaults match the original home-page layout exactly.
  // A page like /play may want a different column count for a narrower
  // content area.
  columns?: { initial?: string; xs?: string; sm?: string; md?: string; lg?: string };
}

export function TournamentCards({ columns = { initial: '1', xs: '2', md: '4' } }: TournamentCardsProps) {
  return (
    <Grid columns={columns} gap="4">
      {tournaments.map((t) => <TournamentCard key={t.name} {...t} />)}
    </Grid>
  );
}

export default TournamentCards;