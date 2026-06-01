// app/api/shopify/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';
import { registerOrderPaidWebhook } from '@/lib/shopify/webhooks';
import { redirectToError } from '@/lib/errors/redirectToError';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';

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



// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');
  // --- SECURITY CHECKS ---
  // These are low-level security failures that real users won't hit in normal
  // flow — keep them as JSON responses (not branded error pages).
  if (!shop || !validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop parameter' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const savedNonce = cookieStore.get('shopify_nonce')?.value;

  if (!savedNonce || savedNonce !== state) {
    console.warn(
      `[ShopifyCallback] Nonce mismatch — cookie: ${savedNonce ?? 'missing'}, state: ${state}. ` +
      `Restarting OAuth.`
    );
    
    const installUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/api/shopify/install`);
    installUrl.searchParams.set('shop', shop);
    return NextResponse.redirect(installUrl);
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
      console.error('[ShopifyCallback] Token exchange failed:', tokenData);
      return redirectToError('token_exchange_failed');
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

    // --- FETCH SHOP ID ---
    // The callback only fires on fresh OAuth install — plan selection redirects
    // directly to /admin/brand, never back through here. So hasActivePlan is
    // always false at this point; the dashboard's confirm-plan endpoint handles
    // setting it true after the merchant selects a plan.
    const shopId = await fetchShopId(shop, access_token);
    const hasActiveSubscription = false;
    console.log(`[ShopifyCallback] Fresh install for ${shop}. shopId: ${shopId ?? 'not fetched'}`);

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
      console.warn('[ShopifyCallback] No authenticated user found — session likely expired.');
      return redirectToError('session_expired');
    }

    if (!user.adminLocationId) {
      console.warn(
        `[ShopifyCallback] User ${user.id} has no adminLocationId — not a brand admin.`
      );
      return redirectToError('no_admin_permissions');
    }

    const clientId = user.adminLocationId;

    // ── Guard against connecting a different store when rewards exist ─────
    // Someone could manually hit /api/shopify/install?shop=otherstore even
    // if the UI blocked them. If this client already has a different shop
    // connected AND has rewards configured, block the change at the API level.
    const existingClient = await Client.findById(clientId)
      .select('shopify.shopDomain')
      .lean() as { shopify?: { shopDomain?: string } } | null;

    const existingDomain = existingClient?.shopify?.shopDomain;
    const isDomainChange = existingDomain && existingDomain !== shop;

    if (isDomainChange) {
      const hasRewards = await SourceRewardConfig.exists({
        'sponsorships.sponsoringClientId': clientId,
      });
      if (hasRewards) {
        console.warn(
          `[ShopifyCallback] Blocked domain change for client ${clientId}: ` +
          `has rewards configured. Existing: ${existingDomain}, Attempted: ${shop}`
        );
        return redirectToError('unknown');
      }
    }

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
    // Always write hasActivePlan — covers both fresh installs and reinstalls
    updateFields['shopify.hasActivePlan'] = hasActiveSubscription;
    console.log(`[ShopifyCallback] Writing to DB — hasActivePlan: false (plan selected later via /admin/brand)`);

    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedClient) {
      console.error(`[ShopifyCallback] Client not found for id: ${clientId}`);
      return redirectToError('client_not_found');
    }
    console.log(`[ShopifyCallback] DB write complete — shopify.hasActivePlan: ${updatedClient.shopify?.hasActivePlan}, redirecting to: ${hasActiveSubscription ? '/admin/brand' : 'pricing page'}`);

    await registerOrderPaidWebhook(shop, access_token);

    // Redirect to pricing plans if no active subscription, otherwise dashboard
    const redirectUrl = hasActiveSubscription
      ? new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand`)
      : buildPricingUrl(shop);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('shopify_nonce');
    return response;

  } catch (error) {
    console.error('[ShopifyCallback] Unexpected error:', error);
    return redirectToError('token_exchange_failed');
  }
}

// ── Pricing plan URL builder ───────────────────────────────────────────────────

function buildPricingUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace('.myshopify.com', '');
  const appHandle = process.env.SHOPIFY_APP_HANDLE ?? 'gg-pickleball-3';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}