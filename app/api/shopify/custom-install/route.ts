// app/api/shopify/custom-install/route.ts
//
// Custom app mode only — builds the Shopify OAuth authorize URL and redirects
// the merchant's browser directly to it, setting the nonce as an HttpOnly
// cookie in the same response.
//
// This is a GET so the connect-shopify page can link to it directly
// (window.location.href = '/api/shopify/custom-install'). The redirect happens
// server-side, so credentials and the nonce cookie are never exposed to JS.
//
// Pre-conditions (set by us before the merchant logs in):
//   - client.shopify.shopDomain  e.g. "padelhaus.myshopify.com"
//   - client.shopify.envKey      e.g. "PADELHAUS"
//   - env vars SHOPIFY_API_KEY_PADELHAUS + SHOPIFY_API_SECRET_PADELHAUS

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { getShopifyCredentials } from '@/lib/shopify/getShopifyCredentials';
import { redirectToError } from '@/lib/errors/redirectToError';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return redirectToError('session_expired');
    if (!user.adminLocationId) return redirectToError('no_admin_permissions');

    await connectToDatabase();

    const client = await Client.findById(user.adminLocationId)
      .select('shopify.shopDomain shopify.envKey')
      .lean() as { shopify?: { shopDomain?: string; envKey?: string } } | null;

    const shopDomain = client?.shopify?.shopDomain;
    const envKey = client?.shopify?.envKey;

    if (!shopDomain) {
      console.error(`[CustomInstall] client ${user.adminLocationId} has no shopDomain set`);
      return redirectToError('no_shop_domain');
    }

    const credentials = getShopifyCredentials(envKey);
    if (!credentials) {
      console.error(
        `[CustomInstall] Missing credentials for client ${user.adminLocationId} (envKey: ${envKey ?? 'not set'})`
      );
      return redirectToError('token_exchange_failed');
    }

    const scopes = 'read_discounts,write_discounts,read_orders';
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/shopify/callback`;
    const nonce = crypto.randomUUID();

    const authorizeUrl =
      `https://${shopDomain}/admin/oauth/authorize` +
      `?client_id=${credentials.apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    // Redirect to Shopify and set the nonce as HttpOnly in the same response.
    // The callback verifies this cookie against the state param Shopify echoes back.

    console.log('[CustomInstall] redirect_uri:', redirectUri);
    console.log('[CustomInstall] authorizeUrl:', authorizeUrl);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set('shopify_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });

    return response;
  } catch (err) {
    logError(err, { endpoint: 'GET /api/shopify/custom-install' });
    return redirectToError('token_exchange_failed');
  }
}