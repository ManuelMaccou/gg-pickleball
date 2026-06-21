import { refreshShopifyToken, tokenNeedsRefresh } from './refreshShopifyToken';

const SHOPIFY_API_VERSION = '2025-10';

interface GraphQLResult {
  ok: boolean;
  status: number;
  json: any;
}

async function callShopifyGraphQL(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResult> {
  const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, json };
}

function isAuthError(result: GraphQLResult): boolean {
  if (result.status === 401 || result.status === 403) return true;
  const errors = result.json?.errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (e: any) =>
      e.extensions?.code === 'UNAUTHORIZED' ||
      e.message?.toLowerCase().includes('unauthorized') ||
      e.message?.toLowerCase().includes('access denied') ||
      e.message?.toLowerCase().includes('invalid api key or access token')
  );
}

/**
 * Calls Shopify's Admin GraphQL API for a given client, refreshing the access
 * token proactively (near expiry) or reactively (on auth error) as needed.
 * refreshShopifyToken persists the new token to the DB itself.
 */
export async function shopifyGraphQLWithRefresh(
  clientId: string,
  shopDomain: string,
  accessToken: string,
  tokenExpiresAt: Date | undefined,
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResult & { accessTokenUsed: string; refreshFailed?: string }> {
  let token = accessToken;

  if (tokenNeedsRefresh(tokenExpiresAt)) {
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      token = refreshResult.accessToken;
    }
    // If proactive refresh fails, fall through and try with the existing
    // token — it might still work for a few more minutes.
  }

  let result = await callShopifyGraphQL(shopDomain, token, query, variables);

  if (isAuthError(result)) {
    const refreshResult = await refreshShopifyToken(clientId);
    if (refreshResult.success && refreshResult.accessToken) {
      token = refreshResult.accessToken;
      result = await callShopifyGraphQL(shopDomain, token, query, variables);
    } else {
      return { ...result, accessTokenUsed: token, refreshFailed: refreshResult.error };
    }
  }

  return { ...result, accessTokenUsed: token };
}