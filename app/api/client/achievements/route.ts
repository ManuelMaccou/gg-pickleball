import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Invalid or missing clientId' }, { status: 400 });
    }

    const client = await Client.findById(clientId).populate('achievements');

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ achievements: client.achievements });
  } catch (error) {
    console.error('[GET /api/client/achievements] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
