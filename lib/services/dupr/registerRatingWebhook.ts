import { authenticatedDuprFetch } from '@/lib/services/dupr/duprAuth';

export async function registerDuprWebhook(): Promise<void> {
  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
  const WEBHOOK_URL = process.env.DUPR_WEBHOOK_URL;

  if (!DUPR_API_BASE_URL) throw new Error('Missing DUPR_API_BASE_URL');
  if (!WEBHOOK_URL) throw new Error('Missing DUPR_WEBHOOK_URL env variable');

  const url = `https://${DUPR_API_BASE_URL}/api/v1.0/webhook`;

  const res = await authenticatedDuprFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      webhookUrl: WEBHOOK_URL,
      topics: ['RATING'],
    }),
  });

  const text = await res.text();
  console.log(`[DUPR Webhook Registration] Status: ${res.status}, Body: ${text}`);

  if (!res.ok) {
    throw new Error(`Failed to register webhook (${res.status}): ${text}`);
  }

  console.log('[DUPR Webhook Registration] Successfully registered.');
}