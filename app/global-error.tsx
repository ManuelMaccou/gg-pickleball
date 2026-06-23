"use client";

import { useEffect } from "react";
import { useRouter } from 'next/navigation';
import NextError from "next/error";
import { logError } from '@/lib/sentry/logger';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();

  useEffect(() => {
    // Import logger dynamically to avoid server-only imports at module load
    (async () => {
      try {
        const errorId = logError(error, { source: 'global-error' });

        // Navigate to the styled error page with the error id so users see branded UI
        const params = new URLSearchParams();
        params.set('reason', 'unknown');
        if (errorId) params.set('errorId', errorId);

        router.replace(`/error?${params.toString()}`);
      } catch (err) {
        // Fallback: ensure exception is at least logged to console
        // eslint-disable-next-line no-console
        console.error('[GlobalError] Failed to capture/log error', err);
      }
    })();
  }, [error, router]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}