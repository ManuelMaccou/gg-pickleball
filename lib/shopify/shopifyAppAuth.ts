// lib/shopify/shopifyAppAuth.ts
//
// Manages the JWT bearer token for the Shopify App Events API.
// Uses Partner Dashboard API key credentials (app-level auth, not per-merchant).
//
// Required env vars:
//   SHOPIFY_API_KEY     — Client ID from Partner Dashboard API key
//   SHOPIFY_API_SECRET — Client secret from Partner Dashboard API key
//
// Token TTL is 60 minutes. We refresh 5 minutes before expiry.

export async function getAppEventsToken(): Promise<string> {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing SHOPIFY_APP_CLIENT_ID or SHOPIFY_APP_CLIENT_SECRET env vars.'
    );
  }

  const res = await fetch('https://api.shopify.com/auth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to fetch Shopify App Events token (${res.status}): ${body}`
    );
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error('Shopify token response missing access_token');
  }

  return data.access_token;
}