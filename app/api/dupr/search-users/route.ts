// app/api/dupr/search-users/route.ts
//
// Proxy for DUPR's user search endpoint.
// Keeps DUPR credentials server-side and prevents direct client access.
// Used by the UploadMatchesDrawer player search UI.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { authenticatedDuprFetch } from '@/lib/services/dupr/duprAuth';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query')?.trim();

    if (!query || query.length < 3) {
      return NextResponse.json({ error: 'Query must be at least 3 characters.' }, { status: 400 });
    }

    const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
    if (!DUPR_API_BASE_URL) {
      return NextResponse.json({ error: 'DUPR configuration error.' }, { status: 500 });
    }

    const response = await authenticatedDuprFetch(
      `https://${DUPR_API_BASE_URL}/api/user/v1.0/search`, 
      {
        method: 'POST',
        body: JSON.stringify({ query, limit: 25, offset: 0 }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DUPR Search] API failed (${response.status}):`, errText);
      return NextResponse.json(
        { error: 'Failed to search DUPR users. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Normalize hits to only what the UI needs.
    const hits = (data?.result?.hits ?? []).map((h: any) => ({
      duprId: h.id,
      fullName: h.fullName ?? 'Unknown',
      doublesRating: parseDuprRating(h.ratings?.doubles),
    }));

    return NextResponse.json({ hits });
  } catch (err) {
    console.error('[GET /api/dupr/search-users]', err);
    const errorId = logError(err, { endpoint: 'GET /api/dupr/search-users' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}

function parseDuprRating(val: unknown): number | null {
  if (val == null || val === 'NR') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}