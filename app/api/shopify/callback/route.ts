// app/api/shopify/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';
import { registerOrderPaidWebhook } from '@/lib/shopify/webhooks';

const SHOPIFY_API_VERSION = '2025-10';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchShopId(
  shopDomain: string,
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: '{ shop { id } }' }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[ShopifyCallback] Failed to fetch shopId (${res.status}):`, body);
      return null;
    }
    const json = await res.json();
    return json?.data?.shop?.id ?? null;
  } catch (err) {
    console.error('[ShopifyCallback] Error fetching shopId:', err);
    return null;
  }
}

async function fetchActiveSubscriptions(
  shopDomain: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: `
            query {
              currentAppInstallation {
                activeSubscriptions {
                  id
                  name
                  status
                  currentPeriodEnd
                }
              }
            }
          `,
        }),
      }
    );
    if (!res.ok) {
      console.error(`[ShopifyCallback] Failed to fetch subscriptions (${res.status})`);
      return false;
    }
    const json = await res.json();
    const subs = json?.data?.currentAppInstallation?.activeSubscriptions ?? [];
    return subs.length > 0;
  } catch (err) {
    console.error('[ShopifyCallback] Error fetching subscriptions:', err);
    return false;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  // --- SECURITY CHECKS ---
  if (!shop || !validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop parameter' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const savedNonce = cookieStore.get('shopify_nonce')?.value;

  if (!savedNonce || savedNonce !== state) {
    console.error(`Nonce mismatch! Cookie: ${savedNonce}, State: ${state}`);
    return NextResponse.json(
      { error: 'Request origin could not be verified (Nonce mismatch)' },
      { status: 403 }
    );
  }

  if (!hmac || !verifyShopifyHmac(searchParams)) {
    console.error('HMAC validation failed');
    return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // --- GET ACCESS TOKEN ---
  const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
  const payload = {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code,
    expiring: 1,
  };

  try {
    const tokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Shopify Token Exchange Failed:', tokenData);
      return NextResponse.json(
        { error: 'Failed to exchange token', details: tokenData },
        { status: 500 }
      );
    }

    const {
      access_token,
      scope,
      expires_in,
      refresh_token,
      refresh_token_expires_in,
    } = tokenData;

    // Calculate expiry timestamps
    const now = Date.now();
    const tokenExpiresAt = expires_in
      ? new Date(now + expires_in * 1000)
      : null;
    const refreshTokenExpiresAt = refresh_token_expires_in
      ? new Date(now + refresh_token_expires_in * 1000)
      : null;

    // --- FETCH SHOP ID & SUBSCRIPTION STATUS IN PARALLEL ---
    const [shopId, hasActiveSubscription] = await Promise.all([
      fetchShopId(shop, access_token),
      fetchActiveSubscriptions(shop, access_token),
    ]);

    if (!shopId) {
      console.warn(
        `[ShopifyCallback] Could not fetch shopId for ${shop}. ` +
        `Will be fetched lazily on first billing event.`
      );
    }

    // --- SAVE TO DATABASE ---
    await connectToDatabase();

    const user = await getAuthorizedUser(req);

    if (!user) {
      const errorUrl = new URL(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand/connect-shopify`
      );
      errorUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(errorUrl);
    }

    if (!user.adminLocationId) {
      return NextResponse.json(
        { error: 'No admin permissions found for this user.' },
        { status: 403 }
      );
    }

    const clientId = user.adminLocationId;

    // Dot-notation $set — each field updated independently so a second
    // OAuth pass (e.g. after plan selection) never wipes shopId.
    const updateFields: Record<string, unknown> = {
      retailSoftware: 'shopify',
      'shopify.shopDomain': shop,
      'shopify.accessToken': access_token,
      'shopify.scope': scope,
      'shopify.connectedAt': new Date(),
    };

    if (shopId) updateFields['shopify.shopId'] = shopId;
    if (refresh_token) updateFields['shopify.refreshToken'] = refresh_token;
    if (tokenExpiresAt) updateFields['shopify.tokenExpiresAt'] = tokenExpiresAt;
    if (refreshTokenExpiresAt) updateFields['shopify.refreshTokenExpiresAt'] = refreshTokenExpiresAt;

    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await registerOrderPaidWebhook(shop, access_token);

    // Redirect to pricing plans if no active subscription, otherwise dashboard
    const redirectUrl = hasActiveSubscription
      ? new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand`)
      : buildPricingUrl(shop);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('shopify_nonce');
    return response;

  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ── Pricing plan URL builder ───────────────────────────────────────────────────

function buildPricingUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace('.myshopify.com', '');
  const appHandle = process.env.SHOPIFY_APP_HANDLE ?? 'gg-pickleball-3';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}