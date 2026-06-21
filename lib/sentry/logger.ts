// lib/sentry/logger.ts
import * as Sentry from '@sentry/nextjs';

const env = process.env.ENV ?? process.env.NEXT_PUBLIC_ENV;

export function logError(error: unknown, context?: Record<string, unknown>): string | undefined {
  console.error('[Error]', error, context ?? {});

  try {
    const eventId = Sentry.captureException(error, {
      extra: context,
    });
    return eventId as string | undefined;
  } catch (err) {
    console.error('[Sentry] Failed to capture exception:', err);
    return undefined;
  }
}

export function logMessage(message: string, context?: Record<string, unknown>) {
  console.log('[Log]', message, context ?? {});

  try {
    Sentry.captureMessage(message, {
      level: 'info',
      extra: context,
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture message:', err);
  }
}