// app/api/shopify/install/route.ts
//
// Public app mode only — initiates Shopify OAuth for App Store installs.
// Shopify hits this endpoint directly after a merchant clicks "Install" on
// the App Store listing, with ?shop=... and ?hmac=... already appended.
// HMAC is always required — the only legitimate entry point is via Shopify.
//
// Custom app mode: this route is NOT used. The connect-shopify page builds
// the OAuth authorize URL directly using the client's stored shopDomain and
// envKey, and redirects to Shopify without going through this route.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';
import { getShopifyCredentials } from '@/lib/shopify/getShopifyCredentials';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get('shop');

    if (!shop || !validateShopDomain(shop)) {
      return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
    }

    // HMAC is required — the only legitimate entry point is Shopify's redirect
    // from the App Store listing, which always signs these params.
    const hmac = searchParams.get('hmac');
    if (!hmac || !verifyShopifyHmac(searchParams)) {
      return NextResponse.json({ error: 'Invalid or missing HMAC signature' }, { status: 401 });
    }

    // Public mode uses shared credentials.
    const credentials = getShopifyCredentials();
    if (!credentials) {
      console.error('[ShopifyInstall] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const scopes = 'read_discounts,write_discounts,read_orders';
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/shopify/callback`;
    const nonce = crypto.randomUUID();

    const installUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${credentials.apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    const response = NextResponse.redirect(installUrl);
    response.cookies.set('shopify_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });

    return response;
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/shopify/install' });
    return NextResponse.json({ error: 'Internal server error', errorId }, { status: 500 });
  }
}