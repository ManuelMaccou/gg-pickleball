import crypto from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';

async function getRawBody(req: Request): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder('utf-8');
  let rawBody = '';
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (value) rawBody += decoder.decode(value, { stream: true });
    done = readerDone;
  }

  return rawBody;
}

export async function validateShopifyWebhook(req: Request): Promise<{
  valid: boolean;
  rawBody: string;
}> {
  await connectToDatabase();

  const shopDomain = req.headers.get('x-shopify-shop-domain');
  console.log('shopify domain in validateWebhook:', shopDomain);
  
  const shopifyHmac = req.headers.get('x-shopify-hmac-sha256');
  console.log('shopifyHmac:', shopifyHmac)


  if (!shopDomain || !shopifyHmac) {
    console.warn('❌ Missing required Shopify headers');
    return { valid: false, rawBody: '' };
  }

  const client = await Client.findOne({ 'shopify.shopDomain': shopDomain });
  if (!client) {
    console.warn(`❌ No client found for shop domain: ${shopDomain}`);
    return { valid: false, rawBody: '' };
  }

  if (!client.shopify?.secret) {
    console.warn(`❌ Client secret not found for client ${client.name}`);
    return { valid: false, rawBody: '' };
  }

  const secret = client.shopify.secret;
  const rawBody = await getRawBody(req);
  console.log('rawBody:', rawBody)

  if (!rawBody) {
    console.warn('❌ rawBody is empty');
    return { valid: false, rawBody: '' };
  }

  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  console.log('calculatedHmac:', calculatedHmac)


  const hmacIsValid = crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(shopifyHmac),
  );

  return { valid: hmacIsValid, rawBody };
}
