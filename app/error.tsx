'use client';

import Link from 'next/link';

interface RootErrorProps {
  error: Error;
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px',
        backgroundColor: '#050505',
        color: '#ffffff',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 620 }}>
        <p style={{ margin: 0, fontSize: 16, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a8a8a8' }}>
          Unexpected error
        </p>
        <h1 style={{ margin: '18px 0', fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 1, letterSpacing: '-0.05em' }}>
          Something went wrong
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 18, color: '#d0d0d0' }}>
          We encountered an error while loading this page. Refresh the page or return to the homepage.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 24px',
              borderRadius: 9999,
              backgroundColor: '#b2ff00',
              color: '#000000',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Return home
          </Link>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 24px',
              borderRadius: 9999,
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
        <p style={{ marginTop: 28, fontSize: 14, color: '#7a7a7a', wordBreak: 'break-word' }}>
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
      </div>
    </main>
  );
}
