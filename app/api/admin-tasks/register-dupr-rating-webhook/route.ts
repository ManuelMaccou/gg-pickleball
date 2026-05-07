import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { registerDuprWebhook } from '@/lib/services/dupr/registerRatingWebhook';


// POST /api/admin-tasks/register-dupr-webhook
// One-time call to register the webhook with DUPR.
export async function POST(req: NextRequest) {
  // Allow auth via admin secret header (for cURL/Postman) or session (for browser)
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  try {
    await registerDuprWebhook();
    return NextResponse.json({ success: true, message: 'Webhook registered with DUPR.' });
  } catch (error) {
    console.error('[Register Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register webhook' },
      { status: 500 }
    );
  }
}