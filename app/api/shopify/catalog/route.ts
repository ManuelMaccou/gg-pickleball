// app/api/shopify/catalog/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { getValidShopifyCredentials } from '@/lib/shopify/getValidShopifyCredentials';
import { logError } from '@/lib/sentry/logger';

const SHOPIFY_API_VERSION = '2025-10';

const PRODUCTS_QUERY = `
  query CatalogProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        variantsCount { count }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query CatalogCollections($first: Int!, $after: String, $query: String) {
    collections(first: $first, after: $after, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        productsCount { count }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (!authorizedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const type = searchParams.get('type'); // 'products' | 'collections'
    const query = searchParams.get('query') || undefined;
    const after = searchParams.get('cursor') || undefined;
    const first = Math.min(Number(searchParams.get('first')) || 20, 50);

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Invalid or missing clientId' }, { status: 400 });
    }
    if (type !== 'products' && type !== 'collections') {
      return NextResponse.json({ error: "type must be 'products' or 'collections'" }, { status: 400 });
    }

    await connectToDatabase();

    const credentials = await getValidShopifyCredentials(clientId);
    if (!credentials) {
      return NextResponse.json({ error: 'This client has no active Shopify connection.' }, { status: 409 });
    }

    // Partial title match. See note below on variant/SKU search.
    const shopifyQuery = query ? `title:*${query.replace(/["\\]/g, '')}*` : undefined;

    const response = await fetch(
      `https://${credentials.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': credentials.accessToken,
        },
        body: JSON.stringify({
          query: type === 'products' ? PRODUCTS_QUERY : COLLECTIONS_QUERY,
          variables: { first, after, query: shopifyQuery },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API HTTP Error (${response.status}): ${await response.text()}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`Shopify System Error: ${json.errors[0].message}`);
    }

    const connection = type === 'products' ? json.data?.products : json.data?.collections;

    const items = type === 'products'
      ? connection.nodes.map((p: any) => ({
          productId: p.id,
          title: p.title,
          variantCount: p.variantsCount?.count,
          price: p.priceRangeV2?.minVariantPrice
            ? `$${Number(p.priceRangeV2.minVariantPrice.amount).toFixed(2)}`
            : undefined,
        }))
      : connection.nodes.map((c: any) => ({
          collectionId: c.id,
          title: c.title,
          productCount: c.productsCount?.count ?? 0,
        }));

    return NextResponse.json({ items, pageInfo: connection.pageInfo });
  } catch (error) {
    const errorId = logError(error, { endpoint: 'GET /api/shopify/catalog' });
    return NextResponse.json({ errorId, error: 'Failed to fetch Shopify catalog' }, { status: 500 });
  }
}