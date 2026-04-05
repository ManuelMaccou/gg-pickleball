import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Match from '@/app/models/Match';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import { authenticatedDuprFetch } from '@/lib/services/duprAuth';

async function fetchDuprMatchList(
  duprId: string, 
  offset: number, 
  startDateSeconds: number,
  endDateSeconds: number
) {
  const DUPR_API_BASE_URL = process.env.DUPR_API_BASE_URL;
  
  const response = await authenticatedDuprFetch(`https://${DUPR_API_BASE_URL}/api/match/history/search`, {
      method: 'POST',
      body: JSON.stringify({
          offset,
          limit: 10, // Fetch a page of 10
          eventFormat: ["DOUBLES"],
          duprId,
          startDate: startDateSeconds, 
          endDate: endDateSeconds      
      })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DUPR Search API Error (${response.status}): ${errorText}`);
  }
  return await response.json();
}

export async function GET(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await connectToDatabase();
    
    // 1. Setup User & Dates
    const userDoc = await User.findById(authorizedUser.id);
    if (!userDoc?.dupr?.id) return NextResponse.json({ error: 'DUPR ID not linked.' }, { status: 400 });

    const duprId = userDoc.dupr.id;

    // Note: Manual DUPR_TOKEN check removed here. The Auth service handles it.

    const now = DateTime.now();
    const startWindow = now.minus({ months: 6 });
    const endDateSeconds = Math.floor(now.toSeconds());
    const startDateSeconds = Math.floor(startWindow.toSeconds());
    const cutoffDate = startWindow.toJSDate();

    // 2. Fetch from DUPR
    let potentialMatches: any[] = [];
    let offset = 0;
    let keepFetching = true;

    while (keepFetching) {
        // Updated call signature (no token)
        const data = await fetchDuprMatchList(duprId, offset, startDateSeconds, endDateSeconds);
        const pageResults = data.results || [];
        
        if (pageResults.length === 0) break;

        for (const match of pageResults) {
            // Safe Date Parsing
            let matchDateVal: Date;
            if (typeof match.matchDate === 'number') {
                matchDateVal = new Date(match.matchDate * 1000);
            } else if (match.eventDate) {
                matchDateVal = new Date(match.eventDate);
            } else {
                matchDateVal = new Date();
            }

            // Stop fetching if we hit dates older than 6 months
            if (matchDateVal < cutoffDate) {
                keepFetching = false;
                break;
            }
            
            potentialMatches.push({
                matchId: match.matchId, // Keep as Number (from API)
                matchDate: matchDateVal.toISOString(),
                eventName: match.displayString || match.eventName || "Unknown Event",
                format: match.matchFormat,
                isSynced: false // Default
            });
        }

        if (keepFetching && pageResults.length === 10) {
            offset += 10;
        } else {
            keepFetching = false;
        }
    }

    // 3. Optimistic Sync Check
    // If we have ANY record of this match ID for this user, assume it's synced.
    if (potentialMatches.length > 0) {
        
        // Ensure IDs are Numbers to match DB storage
        const matchIds = potentialMatches.map(m => Number(m.matchId));
        
        // Find which IDs exist in the DB for this user
        const existingMatches = await Match.find({
            duprMatchId: { $in: matchIds },
            processedUsers: new Types.ObjectId(authorizedUser.id) // Check if YOU are processed
        }).select('duprMatchId').lean();

        // Create a Set of IDs that are "Done"
        // Convert to String for reliable Set lookup
        const syncedSet = new Set(existingMatches.map((m: any) => m.duprMatchId.toString()));

        potentialMatches = potentialMatches.map(m => ({
            ...m,
            // Check if this ID exists in the "Done" set
            isSynced: syncedSet.has(m.matchId.toString())
        }));
    }

    return NextResponse.json({ matches: potentialMatches });

  } catch (error: any) {
    console.error("Preview Sync Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}