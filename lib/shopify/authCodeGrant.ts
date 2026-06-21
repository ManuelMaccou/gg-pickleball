import crypto from 'crypto';

/**
 * Verifies the HMAC signature provided by Shopify.
 *
 * In public app mode, the secret is read from SHOPIFY_API_SECRET (default).
 * In custom app mode, the caller passes the client-specific secret resolved
 * via getShopifyCredentials(envKey) so the correct app's secret is used.
 *
 * @param searchParams - The OAuth callback query parameters
 * @param secret       - Optional: override the default SHOPIFY_API_SECRET.
 *                       Pass the client-specific secret in custom app mode.
 */
export function verifyShopifyHmac(
  searchParams: URLSearchParams,
  secret?: string
): boolean {
  const hmac = searchParams.get('hmac');
  const resolvedSecret = secret ?? process.env.SHOPIFY_API_SECRET;

  if (!hmac || !resolvedSecret) {
    console.error('[verifyShopifyHmac] Missing HMAC or secret');
    return false;
  }

  // 1. Remove 'hmac' from the params
  const map = new Map<string, string>();
  searchParams.forEach((value, key) => {
    if (key !== 'hmac') map.set(key, value);
  });

  // 2. Sort keys alphabetically
  const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  // 3. Construct the message string: "key=value&key=value"
  const message = sortedKeys.map(key => `${key}=${map.get(key)}`).join('&');

  // 4. Generate the hash
  const generatedHash = crypto
    .createHmac('sha256', resolvedSecret)
    .update(message)
    .digest('hex');

  // 5. Timing-safe compare (prevents timing attacks)
  try {
    const a = Buffer.from(generatedHash, 'utf-8');
    const b = Buffer.from(hmac, 'utf-8');
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validates that the shop domain ends in .myshopify.com and contains valid characters.
 */
export function validateShopDomain(shop: string | null): boolean {
  if (!shop) return false;
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return regex.test(shop);
}