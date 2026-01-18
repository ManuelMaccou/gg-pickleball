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
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  await connectToDatabase();
  const client = await Client.findById(clientId);
  if (!client?.shopify?.accessToken) return NextResponse.json({ error: 'Client not connected to Shopify' }, { status: 400 });

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

  const response = await fetch(`https://${client.shopify.shopDomain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': client.shopify.accessToken,
    },
    body: JSON.stringify({ query }),
  });

  const json = await response.json();
  return NextResponse.json(json.data.webhookSubscriptions.edges);
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
    
    await registerOrderPaidWebhook(client.shopify.shopDomain, client.shopify.accessToken);

    return NextResponse.json({ success: true });
}