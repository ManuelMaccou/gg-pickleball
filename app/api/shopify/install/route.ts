import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get('shop');

  // 1. Validation
  if (!shop || !validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  // 2. HMAC Verification (If present)
  // This happens if the user clicked "Install" from the Shopify App Store directly.
  const hmac = searchParams.get('hmac');
  if (hmac) {
    if (!verifyShopifyHmac(searchParams)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }
  }

  // --- STEP 2: BUILD AUTHORIZATION URL ---

  const apiKey = process.env.SHOPIFY_API_KEY; // This is the "Client ID"
  if (!apiKey) {
    console.error("Missing SHOPIFY_API_KEY");
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const scopes = 'read_discounts,write_discounts,read_merchant_managed_fulfillment_orders,read_orders,read_third_party_fulfillment_orders'; 
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/shopify/callback`;
  
  // Create a unique nonce
  const nonce = crypto.randomUUID();

  // Build the Shopify OAuth URL
  // We use offline access mode (no 'grant_options[]') because your server needs
  // to generate discounts in the background when no user is present.
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  // Create the response object so we can set a cookie
  const response = NextResponse.redirect(installUrl);

  // Set the nonce cookie (HttpOnly, Secure)
  // We will check this in the callback to ensure the request originated from us.
  response.cookies.set('shopify_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600 // 1 hour expiration
  });

  return response;
}