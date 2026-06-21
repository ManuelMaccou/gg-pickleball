import { NextResponse } from 'next/server';

export type ErrorReason =
  | 'approved_setup_incomplete'
  | 'no_admin_permissions'
  | 'session_expired'
  | 'client_not_found'
  | 'token_exchange_failed'
  | 'store_change_blocked'
  | 'no_shop_domain'
  | 'unknown';

export function redirectToError(reason: ErrorReason, errorId?: string): NextResponse {
  const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
  url.searchParams.set('reason', reason);
  if (errorId) url.searchParams.set('errorId', errorId);
  return NextResponse.redirect(url);
}