// lib/shopify/verifyWebhookHmac.ts
//
// Reusable HMAC verification for all Shopify webhook endpoints.
// Shopify signs webhook payloads with HMAC-SHA256 using the app secret.
// Every webhook handler must verify this before processing the payload.
//
// Custom mode: the secret is resolved per-client from env vars via
//   getShopifyCredentials(client.shopify.envKey). Each client has their
//   own custom app with its own secret.
//
// Public mode: all webhooks are signed with the shared SHOPIFY_API_SECRET.
//   No DB lookup needed.

import crypto from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { isCustomAppMode } from '@/lib/shopify/appMode';
import { getShopifyCredentials } from '@/lib/shopify/getShopifyCredentials';

// ── Core HMAC check ───────────────────────────────────────────────────────────

function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string,
  secret: string
): boolean {
  const calculated = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );
  } catch {
    return false;
  }
}

// ── Secret resolution ─────────────────────────────────────────────────────────

async function resolveWebhookSecret(shopDomain: string): Promise<string | null> {
  if (!isCustomAppMode()) {
    // Public mode — all webhooks signed with the shared app secret
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      console.error('[Shopify Webhook] Missing SHOPIFY_API_SECRET env var');
      return null;
    }
    return secret;
  }

  // Custom mode — look up the client's envKey and resolve their app secret
  await connectToDatabase();

  const client = await Client.findOne({ 'shopify.shopDomain': shopDomain })
    .select('shopify.envKey name')
    .lean() as { shopify?: { envKey?: string }; name?: string } | null;

  if (!client) {
    console.warn(`[Shopify Webhook] No client found for shop domain: ${shopDomain}`);
    return null;
  }

  const envKey = client.shopify?.envKey;
  const credentials = getShopifyCredentials(envKey);

  if (!credentials) {
    console.error(
      `[Shopify Webhook] No credentials for client "${client.name}" ` +
      `(envKey: ${envKey ?? 'not set'}) — cannot verify webhook HMAC`
    );
    return null;
  }

  return credentials.apiSecret;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extracts and verifies the HMAC from a webhook Request.
 * Returns the raw body buffer on success (already read, ready to parse),
 * or null if verification fails.
 *
 * In custom mode, resolves the client-specific secret from env vars using
 * the shop domain in the request headers.
 *
 * Usage:
 *   const body = await verifyAndReadWebhook(req);
 *   if (!body) return new Response('Unauthorized', { status: 401 });
 *   const payload = JSON.parse(body.toString('utf8'));
 */
export async function verifyAndReadWebhook(req: Request): Promise<Buffer | null> {
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  if (!hmacHeader) {
    console.warn('[Shopify Webhook] Missing x-shopify-hmac-sha256 header');
    return null;
  }

  const shopDomain = req.headers.get('x-shopify-shop-domain');
  if (!shopDomain) {
    console.warn('[Shopify Webhook] Missing x-shopify-shop-domain header');
    return null;
  }

  const secret = await resolveWebhookSecret(shopDomain);
  if (!secret) {
    return null;
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  const isValid = verifyShopifyWebhookHmac(rawBody, hmacHeader, secret);

  if (!isValid) {
    console.warn(
      `[Shopify Webhook] HMAC verification failed for ${shopDomain} ` +
      `(mode: ${isCustomAppMode() ? 'custom' : 'public'})`
    );
    return null;
  }

  return rawBody;
}