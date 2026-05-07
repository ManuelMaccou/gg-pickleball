// lib/services/dupr/duprWebhookSubscription.ts
//
// Subscribes users to DUPR webhook events (RATING topic).
// Call this when a user first connects their DUPR account.
// Uses the app-level token (authenticatedDuprFetch), not the user's personal token.

import { authenticatedDuprFetch } from './duprAuth';

/**
 * Subscribe one or more DUPR users to receive rating updates via webhook.
 * On success, DUPR immediately sends a RATING_SEED event to your webhook
 * with each user's current rating.
 *
 * @param duprIds - Array of DUPR IDs to subscribe (e.g. ['V7YZW6'])
 */
export async function subscribeToDuprWebhook(duprIds: string[]): Promise<void> {
  if (duprIds.length === 0) return;

  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
  if (!DUPR_API_BASE_URL) throw new Error('Missing DUPR_API_BASE_URL');

  const url = `https://${DUPR_API_BASE_URL}/api/user/v1.0/subscribe/webhook-event`;

  const res = await authenticatedDuprFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      duprIds,
      topic: 'RATING',
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`[DUPR Webhook Subscribe] Failed (${res.status}):`, text);
    throw new Error(`Failed to subscribe users to DUPR webhook: ${text}`);
  }

  console.log(`[DUPR Webhook Subscribe] Subscribed ${duprIds.length} user(s):`, duprIds);
}