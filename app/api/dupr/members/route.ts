import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { logError } from '@/lib/sentry/logger';
import { DuprMember } from '@/app/types/duprTypes'; // Assuming you centralize this type

// A helper function to fetch a single page of members from DUPR
async function fetchMemberPage(clubId: number, offset: number, token: string): Promise<{ members: DuprMember[], hasMore: boolean }> {
  const response = await fetch(`https://api.dupr.gg/club/${clubId}/members/v1.0/all`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      offset: offset,
      limit: 25, // Use the max limit per page
      query: "*",
      filter: {},
      sort: {
        parameter: "fullNameSort",
        order: "ASC" 
      }
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DUPR Members API request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return {
    members: data.result?.hits || [],
    hasMore: data.result?.hasMore || false,
  };
}

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (authorizedUser?.permission !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { clubId } = await req.json();
    if (!clubId) {
      return NextResponse.json({ error: 'clubId is required.' }, { status: 400 });
    }

    const DUPR_TOKEN = process.env.DUPR_API_BACKEND_BEARER_TOKEN;
    if (!DUPR_TOKEN) {
      throw new Error("DUPR API token is not configured.");
    }

    // --- PAGINATION LOGIC ---
    let allMembers: DuprMember[] = [];
    let hasMore = true;
    let offset = 0;
    const pageLimit = 25;

    console.log(`Starting DUPR member fetch for clubId: ${clubId}`);

    // Loop until the DUPR API tells us there are no more pages
    while (hasMore) {

      const pageResult = await fetchMemberPage(clubId, offset, DUPR_TOKEN);
      
      allMembers = [...allMembers, ...pageResult.members];
      hasMore = pageResult.hasMore;
      offset += pageLimit;
    }

    console.log(`Finished fetching. Total members found: ${allMembers.length}`);
    
    return NextResponse.json({ members: allMembers });

  } catch (error: unknown) {
    // --- COMPLETE ERROR HANDLING ---
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    
    logError(error, { 
      message: 'Error fetching DUPR member list.',
      endpoint: '/api/dupr/members'
    });

    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}