import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ClubEvent } from '@/app/models/ClubEvent';
import { Club } from '@/app/models/Club';
import { ClubUploadedMatch } from '@/app/models/ClubUploadedMatch';
import Match from '@/app/models/Match';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';

// GET /api/club/events/[eventId]/sync-status
//
// For each uploaded match in the event, returns:
//   - The 4 players (from ClubUploadedMatch)
//   - Which of those players have synced (their duprId appears on a User
//     who is referenced in a Match row with the same duprMatchId)
//
// Strategy (2 queries + in-memory join):
//   1. Get all ClubUploadedMatch docs for this event that were submitted
//   2. Get all Match docs whose duprMatchId is in that set, populated with
//      user dupr.id from team1.players and team2.players
//   3. For each uploaded match, check which player duprIds appear in the
//      synced Match rows

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const { eventId } = await params;
    if (!mongoose.isValidObjectId(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }

    const event = await ClubEvent.findById(eventId).lean();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const club = await Club.findById(event.club).lean();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    if (!club.admins.some((a: any) => a.user.toString() === user.id.toString())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. All submitted uploaded matches for this event
    const uploadedMatches = await ClubUploadedMatch.find({
      event: eventId,
      deletedAt: null,
      duprSubmissionStatus: 'submitted',
      duprMatchId: { $exists: true, $ne: null },
    }).lean();

    if (uploadedMatches.length === 0) {
      return NextResponse.json({ matches: [], summary: { totalPlayers: 0, syncedPlayers: 0 } });
    }

    // 2. Find synced Match rows by duprMatchId (string->number conversion)
    const duprMatchIds = uploadedMatches
      .map((m) => Number(m.duprMatchId))
      .filter((n) => !isNaN(n));

    const syncedMatches = await Match.find({ duprMatchId: { $in: duprMatchIds } })
      .populate('team1.players', 'dupr name')
      .populate('team2.players', 'dupr name')
      .lean();

    // 3. Build a map: duprMatchId -> set of player duprIds that synced
    const syncedByDuprMatchId = new Map<number, Set<string>>();
    for (const m of syncedMatches) {
      const key = m.duprMatchId as number;
      if (!syncedByDuprMatchId.has(key)) {
        syncedByDuprMatchId.set(key, new Set());
      }
      const playerSet = syncedByDuprMatchId.get(key)!;

      // Extract dupr.id from populated user objects in both teams
      const allPlayers = [
        ...(m.team1?.players || []),
        ...(m.team2?.players || []),
      ];
      for (const p of allPlayers) {
        // p is a populated User doc with { dupr: { id: '...' }, name: '...' }
        const duprId = (p as any)?.dupr?.id;
        if (duprId) playerSet.add(String(duprId));
      }
    }

    // 4. For each uploaded match, annotate each player with synced status
    const allPlayerDuprIds = new Set<string>();
    const syncedPlayerDuprIds = new Set<string>();

    const matchResults = uploadedMatches.map((um) => {
      const duprId = Number(um.duprMatchId);
      const syncedPlayers = syncedByDuprMatchId.get(duprId) || new Set();

      const annotatePlayer = (player: { name: string; email?: string; duprId: string }) => {
        allPlayerDuprIds.add(player.duprId);
        const synced = syncedPlayers.has(player.duprId);
        if (synced) syncedPlayerDuprIds.add(player.duprId);
        return { ...player, synced };
      };

      return {
        _id: um._id,
        matchDate: um.matchDate,
        duprMatchId: um.duprMatchId,
        teamA: {
          player1: annotatePlayer(um.teamA.player1),
          player2: annotatePlayer(um.teamA.player2),
          game1: um.teamA.game1,
          game2: um.teamA.game2,
          game3: um.teamA.game3,
          game4: um.teamA.game4,
          game5: um.teamA.game5,
        },
        teamB: {
          player1: annotatePlayer(um.teamB.player1),
          player2: annotatePlayer(um.teamB.player2),
          game1: um.teamB.game1,
          game2: um.teamB.game2,
          game3: um.teamB.game3,
          game4: um.teamB.game4,
          game5: um.teamB.game5,
        },
      };
    });

    return NextResponse.json({
      matches: matchResults,
      summary: {
        totalMatches: uploadedMatches.length,
        syncedMatches: duprMatchIds.filter((id) => syncedByDuprMatchId.has(id)).length,
        totalPlayers: allPlayerDuprIds.size,
        syncedPlayers: syncedPlayerDuprIds.size,
      },
    });
  } catch (err) {
    console.error('[GET /api/club/events/[eventId]/sync-status]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}