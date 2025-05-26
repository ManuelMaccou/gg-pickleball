import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import { IAchievement } from '@/app/types/databaseTypes';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an array of achievements' }, { status: 400 });
    }

    const invalid = body.find(
      (a: Partial<IAchievement>) => !a.name || !a.friendlyName || !a.badge
    );

    if (invalid) {
      return NextResponse.json({ error: 'All achievements must have name, friendlyName, and badge' }, { status: 400 });
    }

    const inserted = await Achievement.insertMany(body);

    return NextResponse.json({ message: 'Bulk achievements created', inserted }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/achievements/bulk] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
