import Link from 'next/link';

export default function NotFoundPage() {
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
          Page not found
        </p>
        <h1 style={{ margin: '18px 0', fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 1, letterSpacing: '-0.05em' }}>
          404
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 18, color: '#d0d0d0' }}>
          The page you’re looking for doesn’t exist or has been moved.
        </p>
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
      </div>
    </main>
  );
}
