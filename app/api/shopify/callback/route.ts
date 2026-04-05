import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Client from '@/app/models/Client';
import User from '@/app/models/User';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { validateShopDomain, verifyShopifyHmac } from '@/lib/shopify/authCodeGrant';
import Admin from '@/app/models/Admin';
import { registerOrderPaidWebhook } from '@/lib/shopify/webhooks';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  // --- STEP 3: SECURITY CHECKS ---
  
  if (!shop || !validateShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop parameter' }, { status: 400 });
  }

  // 1. Verify Nonce (State)
  const cookieStore = await cookies();
  const savedNonce = cookieStore.get('shopify_nonce')?.value;

  if (!savedNonce || savedNonce !== state) {
    console.error(`Nonce mismatch! Cookie: ${savedNonce}, State: ${state}`);
    return NextResponse.json({ error: 'Request origin could not be verified (Nonce mismatch)' }, { status: 403 });
  }

  // 2. Verify HMAC
  if (!hmac || !verifyShopifyHmac(searchParams)) {
    console.error('HMAC validation failed');
    return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // --- STEP 4: GET ACCESS TOKEN ---

  const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
  
  // We omit 'expiring' to get a permanent OFFLINE token
  const payload = {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code: code
  };

  try {
    const tokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Shopify Token Exchange Failed:', tokenData);
      return NextResponse.json({ error: 'Failed to exchange token', details: tokenData }, { status: 500 });
    }

    // Success! We have the token.
    const { access_token, scope } = tokenData;

    // --- SAVE TO DATABASE ---

    await connectToDatabase();

    // 1. Identify the logged-in user
    // The resolvedUser already contains the Admin Location ID if they are an admin
    const user = await getAuthorizedUser(req);
    
    if (!user) {
      const errorUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand/connect-shopify`);
      errorUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(errorUrl);
    }

    // 2. Validate permissions
    // We check if the user actually has an admin location associated
    if (!user.adminLocationId) {
       return NextResponse.json({ error: 'No admin permissions found for this user.' }, { status: 403 });
    }

    const clientId = user.adminLocationId;

    // 3. Update the Client Document directly using the ID from the session
    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      {
        $set: {
          retailSoftware: 'shopify',
          shopify: {
            shopDomain: shop,
            accessToken: access_token,
            scope: scope,
            connectedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await registerOrderPaidWebhook(shop, access_token);

    // --- STEP 5: REDIRECT TO APP UI ---
    
    // Construct success URL with the shop name for UI feedback
    const successUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/brand/connect-shopify`);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('connected_shop', shop);

    const response = NextResponse.redirect(successUrl);
    
    // Clean up security cookie
    response.cookies.delete('shopify_nonce');

    return response;

  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}