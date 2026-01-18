import crypto from 'crypto';
import { redeemDiscountCode } from '@/lib/rewards/redeemDiscountCodes';

type DiscountCode = { code: string };

export async function POST(req: Request): Promise<Response> {
  const shopDomain = req.headers.get('x-shopify-shop-domain');
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

  if (!shopDomain || !hmacHeader) {
    console.warn('❌ Missing required Shopify headers');
    return new Response('Missing headers', { status: 400 });
  }

  // Use raw arrayBuffer for verification to avoid body parsing issues
  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  // --- SECURITY CHECK ---
  // Use your APP SECRET from env, not DB
  const appSecret = process.env.SHOPIFY_API_SECRET; 
  
  if (!appSecret) {
    console.error('❌ Server Config Error: Missing SHOPIFY_API_SECRET');
    return new Response('Server Error', { status: 500 });
  }

  const calculatedHmac = crypto
    .createHmac('sha256', appSecret)
    .update(bodyBuffer)
    .digest('base64');

  // Safe compare
  try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculatedHmac, 'base64'),
        Buffer.from(hmacHeader, 'base64')
      );
      
      if (!isValid) {
        console.warn('❌ Invalid HMAC');
        return new Response('Unauthorized', { status: 401 });
      }
  } catch (e) {
      return new Response('Unauthorized', { status: 401 });
  }

  try {
    const bodyString = bodyBuffer.toString('utf8');
    const payload = JSON.parse(bodyString);

    console.log('webhook payload:', payload)

    // Safely extract discount codes
    const discountCodes: string[] = (payload.discount_codes || [])
      .map((dc: any) => dc?.code)
      .filter((code: any): code is string => typeof code === 'string');

    console.log('discountCodes:', discountCodes)

    if (discountCodes.length === 0) {
      // Return 200 to acknowledge receipt (otherwise Shopify retries)
      return new Response('No discount codes', { status: 200 });
    }

    console.log(`✅ Processing Order from ${shopDomain} with codes:`, discountCodes);

    // Call your business logic
    await redeemDiscountCode(discountCodes);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('❌ Error processing webhook:', err);
    // Return 200 even on logic error so Shopify doesn't keep hammering you
    // unless you actually want it to retry (then return 500)
    return new Response('Error', { status: 200 }); 
  }
}