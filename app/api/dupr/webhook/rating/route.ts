import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';

// POST /api/dupr/webhook
// Receives webhook events from DUPR (RATING and RATING_SEED events).
// Must respond with 200 quickly or DUPR will retry/drop the webhook.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.event;
    const message = body.message;

    console.log(`[DUPR Webhook] Received ${event} event for ${message?.duprId}`);

    if ((event === 'RATING' || event === 'RATING_SEED') && message?.duprId) {
      await handleRatingUpdate(message);
    } else {
      console.log('[DUPR Webhook] Unhandled event type:', event);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[DUPR Webhook] Error processing event:', error);
    // Still return 200 so DUPR doesn't retry
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// GET /api/dupr/webhook
// Some webhook systems send a GET to verify the endpoint exists
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handleRatingUpdate(message: {
  duprId: string;
  name?: string;
  timestamp?: number;
  rating?: {
    singles?: string | null;
    doubles?: string | null;
    singlesReliability?: number | null;
    doublesReliability?: number | null;
    matchId?: number | null;
    singlesProvisional?: boolean | null;
    doublesProvisional?: boolean | null;
  } | null;
  metrics?: {
    statistics?: {
      singles?: { careerHigh?: string };
      doubles?: { careerHigh?: string };
    };
  } | null;
}) {
  try {
    await connectToDatabase();

    const { duprId, rating, metrics } = message;

    // Parse ratings — DUPR sends them as strings, some may be "null"
    const doublesRating = rating?.doubles && rating.doubles !== 'null'
      ? parseFloat(rating.doubles)
      : null;
    const singlesRating = rating?.singles && rating.singles !== 'null'
      ? parseFloat(rating.singles)
      : null;
    const doublesCareerHigh = metrics?.statistics?.doubles?.careerHigh &&
      metrics.statistics.doubles.careerHigh !== '-1'
      ? parseFloat(metrics.statistics.doubles.careerHigh)
      : null;
    const singlesCareerHigh = metrics?.statistics?.singles?.careerHigh &&
      metrics.statistics.singles.careerHigh !== '-1'
      ? parseFloat(metrics.statistics.singles.careerHigh)
      : null;

    // Build update — only set fields that have real values
    const update: Record<string, unknown> = {};
    if (doublesRating !== null) update['dupr.doublesRating'] = doublesRating;
    if (singlesRating !== null) update['dupr.singlesRating'] = singlesRating;
    if (doublesCareerHigh !== null) update['dupr.doublesCareerHigh'] = doublesCareerHigh;
    if (singlesCareerHigh !== null) update['dupr.singlesCareerHigh'] = singlesCareerHigh;
    if (rating?.doublesProvisional !== null && rating?.doublesProvisional !== undefined) {
      update['dupr.doublesProvisional'] = rating.doublesProvisional;
    }
    if (rating?.singlesProvisional !== null && rating?.singlesProvisional !== undefined) {
      update['dupr.singlesProvisional'] = rating.singlesProvisional;
    }
    update['dupr.lastRatingUpdate'] = new Date();

    if (Object.keys(update).length === 0) {
      console.log(`[DUPR Webhook] No rating data to update for ${duprId}`);
      return;
    }

    const result = await User.findOneAndUpdate(
      { 'dupr.id': duprId },
      { $set: update },
      { new: true }
    );

    if (result) {
      console.log(`[DUPR Webhook] Updated rating for ${duprId}: doubles=${doublesRating}, singles=${singlesRating}`);
    } else {
      console.warn(`[DUPR Webhook] No user found with dupr.id: ${duprId}`);
    }
  } catch (error) {
    console.error(`[DUPR Webhook] Failed to process rating for ${message.duprId}:`, error);
    // Don't throw — we already returned 200 to DUPR
  }
}