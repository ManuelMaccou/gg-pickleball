// lib/shopify/verifyWebhookHmac.ts
//
// Reusable HMAC verification for all Shopify webhook endpoints.
// Shopify signs webhook payloads with HMAC-SHA256 using your app secret.
// Every webhook handler must verify this before processing the payload.

import crypto from 'crypto';

/**
 * Verifies the HMAC signature on a Shopify webhook request.
 * Must be called with the raw body buffer before any JSON parsing.
 *
 * @returns true if the signature is valid, false otherwise.
 */
export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string
): boolean {
  const appSecret = process.env.SHOPIFY_API_SECRET;
  if (!appSecret) {
    console.error('[Shopify Webhook] Missing SHOPIFY_API_SECRET env var');
    return false;
  }

  const calculated = crypto
    .createHmac('sha256', appSecret)
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

/**
 * Extracts and verifies the HMAC from a webhook Request.
 * Returns the raw body buffer on success (already read, ready to parse),
 * or null if verification fails.
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

  const rawBody = Buffer.from(await req.arrayBuffer());
  const isValid = verifyShopifyWebhookHmac(rawBody, hmacHeader);

  if (!isValid) {
    console.warn('[Shopify Webhook] HMAC verification failed');
    return null;
  }

  return rawBody;
}