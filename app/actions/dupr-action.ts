'use server';

import * as Sentry from '@sentry/nextjs';
import { DuprMatch, DuprMatchApiResponse } from '../types/duprTypes';

const DUPR_API_URL = 'https://api.dupr.gg/player/v1.0';

export async function checkNewRewards(duprUserId: string) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 6); // 6 months ago

  let allMatches: DuprMatch[] = [];
  let offset = 0;
  const LIMIT = 50;
  let hasMore = true;
  let keepFetching = true;

  try {
    while (hasMore && keepFetching) {
      const response = await fetch(
        `${DUPR_API_URL}/${duprUserId}/history?offset=${offset}&limit=${LIMIT}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.DUPR_API_BACKEND_BEARER_TOKEN}`,
            'accept': 'application/json',
          },
          cache: 'no-store', // Ensure we always get fresh data
        }
      );

      if (!response.ok) {
        throw new Error(`DUPR API Error: ${response.statusText}`);
      }

      const data: DuprMatchApiResponse = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error('DUPR API returned non-success status');
      }

      const hits = data.result.hits || [];

      if (hits.length === 0) {
        hasMore = false;
        break;
      }

      // Filter matches within the 6-month window
      for (const match of hits) {
        const matchDate = new Date(match.eventDate);

        if (matchDate >= cutoffDate) {
          allMatches.push(match);
        } else {
          // We hit a match older than 6 months. 
          // Assuming API returns newest first, we can stop entirely.
          keepFetching = false;
        }
      }

      // Check pagination flags
      if (!keepFetching || !data.result.hasMore) {
        hasMore = false;
      } else {
        offset += LIMIT;
      }
    }

    // TODO: Pass `allMatches` to your processing engine here
    // await processMatchesForRewards(allMatches);

    return { success: true, count: allMatches.length, matches: allMatches };

  } catch (error) {
    console.error('DUPR Sync Error:', error);
    Sentry.captureException(error, {
      tags: { service: 'DUPR', action: 'checkNewRewards' },
      extra: { duprUserId }
    });
    return { success: false, error: 'Failed to sync matches' };
  }
}