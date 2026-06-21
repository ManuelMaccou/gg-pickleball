import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { registerWebhooksViaGraphQL } from '@/lib/shopify/registerWebhooksGraphQL';
import { logError } from '@/lib/sentry/logger';
import { shopifyGraphQLWithRefresh } from '@/lib/shopify/shopifyGraphQl';

export async function GET(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId parameter.' }, { status: 400 });

  await connectToDatabase();
  const client = await Client.findById(clientId);

  if (!client) {
    return NextResponse.json({ error: `No Client found in MongoDB with ID: ${clientId}` }, { status: 404 });
  }

  if (!client.shopify?.shopDomain) {
    return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.shopDomain'. You must add the store URL (e.g., store.myshopify.com) to MongoDB before managing webhooks.` }, { status: 400 });
  }

  if (!client.shopify?.accessToken) {
    return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.accessToken'. You must complete the Shopify OAuth flow or manually add the Admin API Access Token to MongoDB.` }, { status: 400 });
  }

  const query = `
    {
      webhookSubscriptions(first: 20) {
        edges {
          node {
            id
            topic
            filter
            endpoint {
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQLWithRefresh(
      clientId,
      client.shopify.shopDomain,
      client.shopify.accessToken,
      client.shopify.tokenExpiresAt,
      query
    );

    if (result.refreshFailed) {
      return NextResponse.json(
        { error: `Shopify access token expired and could not be refreshed (${result.refreshFailed}). The merchant must reconnect Shopify.` },
        { status: 401 }
      );
    }

    if (!result.ok) {
      return NextResponse.json({ error: `Shopify returned ${result.status}` }, { status: 502 });
    }

    if (result.json?.errors) {
      console.error("Shopify GraphQL Error:", result.json.errors);
      return NextResponse.json({ error: `Shopify rejected the request: ${result.json.errors[0].message}` }, { status: 400 });
    }

    const edges = result.json?.data?.webhookSubscriptions?.edges || [];
    return NextResponse.json(edges);
  } catch (error: any) {
    console.error("Fetch Error:", error);
    const errorId = logError(error, { endpoint: 'GET /api/webhooks/shopify/manage-webhooks' });
    return NextResponse.json({ errorId, error: `Failed to connect to Shopify API: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { clientId, webhookId } = body;

  if (!clientId || !webhookId) {
    return NextResponse.json({ error: 'Missing clientId or webhookId.' }, { status: 400 });
  }

  await connectToDatabase();
  const client = await Client.findById(clientId);
  if (!client?.shopify?.accessToken || !client?.shopify?.shopDomain) {
    return NextResponse.json({ error: 'Client not connected' }, { status: 400 });
  }

  const query = `
    mutation webhookSubscriptionDelete($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        userErrors {
          field
          message
        }
        deletedWebhookSubscriptionId
      }
    }
  `;

  try {
    const result = await shopifyGraphQLWithRefresh(
      clientId,
      client.shopify.shopDomain,
      client.shopify.accessToken,
      client.shopify.tokenExpiresAt,
      query,
      { id: webhookId }
    );

    if (result.refreshFailed) {
      return NextResponse.json(
        { error: `Shopify access token expired and could not be refreshed (${result.refreshFailed}). The merchant must reconnect Shopify.` },
        { status: 401 }
      );
    }

    if (!result.ok) {
      console.error(`[ManageWebhooks] DELETE failed (${result.status}):`, result.json);
      return NextResponse.json({ error: `Shopify returned ${result.status}` }, { status: 502 });
    }

    if (result.json?.errors) {
      console.error('Shopify GraphQL Error:', result.json.errors);
      return NextResponse.json({ error: `Shopify rejected the request: ${result.json.errors[0].message}` }, { status: 400 });
    }

    const userErrors = result.json?.data?.webhookSubscriptionDelete?.userErrors;
    if (userErrors?.length > 0) {
      return NextResponse.json({ error: userErrors[0].message }, { status: 400 });
    }

    return NextResponse.json(result.json);
  } catch (error: any) {
    console.error('Fetch Error:', error);
    const errorId = logError(error, { endpoint: 'DELETE /api/webhooks/shopify/manage-webhooks' });
    return NextResponse.json({ errorId, error: `Failed to connect to Shopify API: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { clientId } = body;
  if (!clientId) return NextResponse.json({ error: 'Missing clientId.' }, { status: 400 });

  await connectToDatabase();
  const client = await Client.findById(clientId);

  if (!client) {
    return NextResponse.json({ error: `No Client found in MongoDB with ID: ${clientId}` }, { status: 404 });
  }

  if (!client.shopify?.shopDomain) {
    return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.shopDomain'.` }, { status: 400 });
  }

  if (!client.shopify?.accessToken) {
    return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.accessToken'.` }, { status: 400 });
  }

  const result = await registerWebhooksViaGraphQL(
    client.shopify.shopDomain,
    client.shopify.accessToken,
    clientId,
    client.shopify.tokenExpiresAt
  );

  if (!result.allSucceeded) {
    const failures = result.results
      .filter(r => !r.success)
      .map(r => `${r.topic}: ${r.reason}`)
      .join('; ');
    const errorId = logError(new Error(`Webhook registration partial failure: ${failures}`), {
      endpoint: 'POST /api/webhooks/shopify/manage-webhooks',
    });
    return NextResponse.json({ errorId, error: `Some webhooks failed to register: ${failures}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, registered: result.results.map(r => r.topic) });
}