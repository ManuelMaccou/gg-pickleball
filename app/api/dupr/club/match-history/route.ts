import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { logError } from '@/lib/sentry/logger';
import { DateTime } from 'luxon';
import { DuprMatch } from '@/app/types/duprTypes';

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (authorizedUser?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { clubId, syncUntilDate } = await req.json();
    if (!clubId) {
      return NextResponse.json({ error: 'clubId is required.' }, { status: 400 });
    }

    const DUPR_TOKEN = process.env.DUPR_API_BACKEND_BEARER_TOKEN;
    if (!DUPR_TOKEN) {
      throw new Error("DUPR_API_BACKEND_BEARER_TOKEN is not configured on the server.");
    }

    const duprPayload = {
      offset: 0,
      limit: 250,
      clubId: clubId,
      filters: {
        eventFormat: ["DOUBLES"]
      },
      sort: {
        parameter: "MATCH_DATE",
        order: "ASC"
      }
    };

    const duprResponse = await fetch('https://api.dupr.gg/club/match/v1.0/history', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DUPR_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duprPayload),
    });

    if (!duprResponse.ok) {
      const errorBody = await duprResponse.text();
      throw new Error(`DUPR API request failed: ${errorBody}`);
    }

    const data = await duprResponse.json();
    const allRecentMatches = data.result?.hits || [];

    let filteredMatches = allRecentMatches;

    if (syncUntilDate && typeof syncUntilDate === 'string') {
      const filterDate = DateTime.fromISO(syncUntilDate).startOf('day');
      
      filteredMatches = allRecentMatches.filter((match: DuprMatch) => {
        if (!match.eventDate) return false; // Ignore matches without a date
        const matchDate = DateTime.fromISO(match.eventDate).startOf('day');
        return matchDate >= filterDate;
      });
    }

    return NextResponse.json({ matches: filteredMatches });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    const errorId = logError(error, { 
      message: 'Error fetching DUPR match history.',
      endpoint: 'POST /api/dupr/club/match-history'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}