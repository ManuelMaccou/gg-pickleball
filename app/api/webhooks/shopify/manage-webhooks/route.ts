import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import Client from '@/app/models/Client';
import connectToDatabase from '@/lib/mongodb';
import { registerOrderPaidWebhook } from '@/lib/shopify/webhooks';

export async function GET(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  // Get Client ID from query
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId parameter.' }, { status: 400 });

  await connectToDatabase();
  const client = await Client.findById(clientId);
  
  if (!client) {
      return NextResponse.json({ error: `No Client found in MongoDB with ID: ${clientId}` }, { status: 404 });
  }

  // --- SPECIFIC ERROR CHECKS ---
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
    const response = await fetch(`https://${client.shopify.shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': client.shopify.accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();

    // Check for GraphQL format errors (e.g., invalid token resulting in "Unauthorized")
    if (json.errors) {
        console.error("Shopify GraphQL Error:", json.errors);
        return NextResponse.json({ error: `Shopify rejected the request: ${json.errors[0].message}. Verify the Access Token is valid.` }, { status: 400 });
    }

    const edges = json.data?.webhookSubscriptions?.edges || [];
    return NextResponse.json(edges);
  } catch (error: any) {
      console.error("Fetch Error:", error);
      return NextResponse.json({ error: `Failed to connect to Shopify API: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { clientId, webhookId } = await req.json();

  await connectToDatabase();
  const client = await Client.findById(clientId);
  if (!client?.shopify?.accessToken) return NextResponse.json({ error: 'Client not connected' }, { status: 400 });

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

  const response = await fetch(`https://${client.shopify.shopDomain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': client.shopify.accessToken,
    },
    body: JSON.stringify({ query, variables: { id: webhookId } }),
  });

  const json = await response.json();
  return NextResponse.json(json);
}

export async function POST(req: NextRequest) {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { clientId } = await req.json();

    await connectToDatabase();
    const client = await Client.findById(clientId);
    
    if (!client) {
        return NextResponse.json({ error: `No Client found in MongoDB with ID: ${clientId}` }, { status: 404 });
    }

    // --- SPECIFIC ERROR CHECKS ---
    if (!client.shopify?.shopDomain) {
        return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.shopDomain'.` }, { status: 400 });
    }

    if (!client.shopify?.accessToken) {
        return NextResponse.json({ error: `The Client document (${client.name}) is missing 'shopify.accessToken'.` }, { status: 400 });
    }

    try {
        await registerOrderPaidWebhook(client.shopify.shopDomain, client.shopify.accessToken);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Webhook Registration Error:", error);
        return NextResponse.json({ error: `Failed to register webhook: ${error.message}` }, { status: 500 });
    }
}