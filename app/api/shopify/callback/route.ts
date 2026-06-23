// app/api/shopify/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';
import { registerWebhooksViaGraphQL } from '@/lib/shopify/registerWebhooksGraphQL';
import { redirectToError } from '@/lib/errors/redirectToError';
import { logError } from '@/lib/sentry/logger';
import { buildShopifyPricingUrl } from '@/lib/shopify/urls';
import { isCustomAppMode } from '@/lib/shopify/appMode';
import { getShopifyCredentials } from '@/lib/shopify/getShopifyCredentials';

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

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  try {
    // --- IDENTIFY CLIENT ---
    // Must happen before HMAC verification in custom mode — the HMAC is signed
    // with the client-specific app secret, so we need envKey from the DB to
    // resolve the correct secret before we can verify.
    await connectToDatabase();

    const user = await getAuthorizedUser(req);

    if (!user) {
      console.warn('[ShopifyCallback] No authenticated user found — session likely expired or different browser.');
      return redirectToError('session_expired');
    }

    if (!user.adminLocationId) {
      console.warn(`[ShopifyCallback] User ${user.id} has no adminLocationId — not a brand admin.`);
      return redirectToError('no_admin_permissions');
    }

    const clientId = user.adminLocationId;

    const existingClient = await Client.findById(clientId)
      .select('shopify.shopDomain shopify.envKey')
      .lean() as { shopify?: { shopDomain?: string; envKey?: string } } | null;

    // ── Resolve credentials and verify HMAC ───────────────────────────────
    // In custom mode, each client has their own app secret keyed by envKey.
    // In public mode, falls back to the shared SHOPIFY_API_SECRET.
    const envKey = existingClient?.shopify?.envKey;
    const credentials = getShopifyCredentials(envKey);

    if (!credentials) {
      console.error(
        `[ShopifyCallback] No credentials for client ${clientId} (envKey: ${envKey ?? 'not set'})`
      );
      return redirectToError('token_exchange_failed');
    }

    if (!hmac || !verifyShopifyHmac(searchParams, credentials.apiSecret)) {
      console.error(
        `[ShopifyCallback] HMAC validation failed for client ${clientId} ` +
        `(envKey: ${envKey ?? 'not set'})`
      );
      return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 });
    }

    // ── Guard: one store per client ───────────────────────────────────────
    const existingDomain = existingClient?.shopify?.shopDomain;
    const isDomainChange = !!existingDomain && existingDomain !== shop;

    if (isDomainChange) {
      console.warn(
        `[ShopifyCallback] Blocked domain change for client ${clientId}: ` +
        `Existing: ${existingDomain}, Attempted: ${shop}`
      );
      return redirectToError('store_change_blocked');
    }

    // --- GET ACCESS TOKEN ---
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    const payload = {
      client_id: credentials.apiKey,
      client_secret: credentials.apiSecret,
      code,
      expiring: 1,
    };

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

    const now = Date.now();
    const tokenExpiresAt = expires_in ? new Date(now + expires_in * 1000) : null;
    const refreshTokenExpiresAt = refresh_token_expires_in
      ? new Date(now + refresh_token_expires_in * 1000)
      : null;

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
    updateFields['shopify.hasActivePlan'] = hasActiveSubscription;
    console.log(`[ShopifyCallback] Writing to DB — hasActivePlan: false`);

    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedClient) {
      console.error(`[ShopifyCallback] Client not found for id: ${clientId}`);
      return redirectToError('client_not_found');
    }

    // ── Webhook registration ───────────────────────────────────────────────
    // Custom mode: registers ORDERS_PAID (with GG filter) + compliance webhooks.
    // Public mode: registers ORDERS_PAID only — compliance handled by toml.
    const webhookResult = await registerWebhooksViaGraphQL(
      shop,
      access_token,
      clientId,
      tokenExpiresAt ?? undefined
    );
    if (!webhookResult.allSucceeded) {
      const failures = webhookResult.results
        .filter((r) => !r.success)
        .map((r) => `${r.topic}: ${r.reason}`)
        .join('; ');
      logError(new Error(`Webhook registration partial failure: ${failures}`), {
        endpoint: 'GET /api/shopify/callback',
        task: 'registerWebhooksViaGraphQL',
        shop,
      });
    }

    // ── Post-OAuth redirect — branched by app mode ─────────────────────────
    let redirectUrl: string | URL;

    if (isCustomAppMode()) {
      redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand/billing/payment-method`;
      console.log(`[ShopifyCallback] Custom mode — redirecting to Stripe billing setup`);
    } else {
      redirectUrl = hasActiveSubscription
        ? new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand`)
        : buildShopifyPricingUrl(shop);
      console.log(`[ShopifyCallback] Public mode — redirecting to: ${redirectUrl}`);
    }

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('shopify_nonce');
    return response;

  } catch (error) {
    const errorId = logError(error, { endpoint: 'GET /api/shopify/callback' });
    return redirectToError('token_exchange_failed', errorId);
  }
}