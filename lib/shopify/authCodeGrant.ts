import crypto from 'crypto';

/**
 * Verifies the HMAC signature provided by Shopify.
 * 
 * @param query - The query parameters object (from request.nextUrl.searchParams)
 * @returns boolean - True if valid, False if invalid
 */
export function verifyShopifyHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get('hmac');
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!hmac || !secret) {
    console.error('Missing HMAC or SHOPIFY_API_SECRET');
    return false;
  }

  // 1. Remove 'hmac' from the map
  const map = new Map<string, string>();
  searchParams.forEach((value, key) => {
    if (key !== 'hmac') {
      // Shopify sometimes includes extra params like 'ids' in webhooks, 
      // but for OAuth, we just strip hmac.
      map.set(key, value);
    }
  });

  // 2. Sort keys alphabetically
  const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  // 3. Construct the message string: "key=value&key=value"
  const message = sortedKeys
    .map(key => `${key}=${map.get(key)}`)
    .join('&');

  // 4. Generate the hash
  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // 5. Safe Compare (prevents timing attacks)
  // We use try/catch because timingSafeEqual throws if lengths differ
  try {
    const a = Buffer.from(generatedHash, 'utf-8');
    const b = Buffer.from(hmac, 'utf-8');
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

/**
 * Validates that the shop domain ends in .myshopify.com and contains valid characters
 */
export function validateShopDomain(shop: string | null): boolean {
  if (!shop) return false;
  // Regex to ensure it ends in myshopify.com and has no invalid chars
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return regex.test(shop);
}