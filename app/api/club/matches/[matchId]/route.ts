import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { updateMatchOnDupr, deleteMatchOnDupr } from '@/lib/services/dupr/duprMatches';
import { ClubUploadedMatch } from '@/app/models/ClubUploadedMatch';
import { Club } from '@/app/models/Club';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';

async function loadAndAuthorize(matchId: string, userId: string) {
  if (!mongoose.isValidObjectId(matchId)) return { error: 'Invalid id', status: 400 as const };
  const match = await ClubUploadedMatch.findById(matchId);
  if (!match || match.deletedAt) return { error: 'Not found', status: 404 as const };
  const club = await Club.findById(match.club);
  if (!club) return { error: 'Club not found', status: 404 as const };
  if (!club.admins.some((a: any) => a.user.toString() === userId)) {
    return { error: 'Forbidden', status: 403 as const };
  }
  console.log('match:', match)
  console.log('club:', club)

  return { match, club };
}

// PATCH — all edits proxy to DUPR; local mirror updates only on DUPR success
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
    const loaded = await loadAndAuthorize(matchId, user.id.toString());
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { match, club } = loaded;
 
    if (!match.duprMatchId) {
      return NextResponse.json(
        { error: 'Match has not been submitted to DUPR yet — cannot edit.' },
        { status: 409 }
      );
    }
 
    const body = await req.json();
    const { matchDate, teamA, teamB, location, notes } = body ?? {};
 
    // Build the full match input for DUPR using current values as defaults
    const updatedMatch = {
      matchDate: matchDate ?? match.matchDate,
      teamA: teamA ?? match.teamA,
      teamB: teamB ?? match.teamB,
      location: location ?? match.location,
      clubDuprId: club.duprClubId,
      identifier: match._id.toString(),
      eventName: match.event
        ? await (async () => {
            const { ClubEvent } = await import('@/app/models/ClubEvent');
            const event = await ClubEvent.findById(match.event).select('name').lean();
            return (event as { name?: string } | null)?.name;
          })()
        : undefined,
    };
 
    try {
      await updateMatchOnDupr(match.duprMatchId, match._id.toString(), updatedMatch);
    } catch (duprErr) {
      return NextResponse.json(
        { error: duprErr instanceof Error ? duprErr.message : 'DUPR update failed' },
        { status: 502 }
      );
    }
 
    // Update local record only after DUPR succeeds
    if (matchDate !== undefined) match.matchDate = matchDate;
    if (teamA !== undefined) match.teamA = teamA;
    if (teamB !== undefined) match.teamB = teamB;
    if (location !== undefined) match.location = location;
    if (notes !== undefined) match.notes = notes;
    await match.save();
 
    return NextResponse.json({ match });
  } catch (err) {
    console.error('[PATCH /api/club/matches/[matchId]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE — proxies to DUPR, soft-deletes locally
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const loaded = await loadAndAuthorize(matchId, user.id.toString());
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { match } = loaded;

    console.log('duprMatchId:', match.duprMatchId)

    if (match.duprMatchId) {
      try {
        await deleteMatchOnDupr(match.duprMatchId, match._id.toString());
      } catch (duprErr) {
        return NextResponse.json(
          { error: duprErr instanceof Error ? duprErr.message : 'DUPR delete failed' },
          { status: 502 }
        );
      }
    }

    match.deletedAt = new Date();
    await match.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/club/matches/[matchId]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}