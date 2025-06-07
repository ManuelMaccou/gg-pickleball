// lib/logger.ts
import * as Sentry from '@sentry/nextjs';


const env = process.env.ENV ?? process.env.NEXT_PUBLIC_ENV;

const isProduction = env === 'production';
const isTest = env === 'development';

export function logError(error: unknown, context?: Record<string, unknown>) {
  if (!isProduction || isTest) {
    console.error('[Error]', error, context ?? {});
  }

  if (isProduction) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function logMessage(message: string, context?: Record<string, unknown>) {
  if (!isProduction || isTest) {
    console.log('[Log]', message, context ?? {});
  }

  if (isProduction) {
    Sentry.captureMessage(message, {
      level: 'info',
      extra: context,
    });
  }
}
