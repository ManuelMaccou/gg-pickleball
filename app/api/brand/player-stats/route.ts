import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { logError } from '@/lib/sentry/logger';
import connectToDatabase from "@/lib/mongodb";
import User from "@/app/models/User";
import { requiresBrandAdmin } from "@/lib/auth/requiresBrandAdmin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  // ── Auth guard ────────────────────────────────────────────────────────────
  const auth = await requiresBrandAdmin(request, clientId);
  if (auth.error) return auth.error;
  const verifiedClientId = auth.clientId;

  try {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(verifiedClientId)) {
      return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 });
    }

    const objectIdClient = new Types.ObjectId(verifiedClientId);

    const uniquePlayerCount = await User.countDocuments({
      "stats.global.rewards.sponsoringClientId": objectIdClient
    });

    const topPlayersRaw = await User.find({
      "stats.global.rewards.sponsoringClientId": objectIdClient,
      "stats.global.wins": { $exists: true, $gt: 0 }
    })
      .sort({ "stats.global.wins": -1 })
      .limit(5)
      .select("name stats.global.wins")
      .lean();

    const topPlayers = topPlayersRaw.map((p: any) => ({
      name: p.name,
      winCount: p.stats?.global?.wins || 0
    }));

    return NextResponse.json({ uniquePlayerCount, topPlayers });

  } catch (error) {
    const errorId = logError(error, { endpoint: 'GET /api/brand/player-stats', clientId: verifiedClientId });
    return NextResponse.json({ errorId, error: 'Failed to fetch stats.' }, { status: 500 });
  }
}