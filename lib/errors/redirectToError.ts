import { NextResponse } from 'next/server';

export type ErrorReason =
  | 'no_admin_permissions'
  | 'session_expired'
  | 'client_not_found'
  | 'token_exchange_failed'
  | 'store_change_blocked'
  | 'unknown';

export function redirectToError(reason: ErrorReason): NextResponse {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}