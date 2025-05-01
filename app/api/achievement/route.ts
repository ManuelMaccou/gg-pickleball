import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Achievement from '@/app/models/Achievement';
import { IAchievement } from '@/app/types/databaseTypes';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { friendlyName, name, badge } = body as IAchievement;

    if (!friendlyName || !name || !badge) {
      return NextResponse.json({ error: 'Name and badge are required' }, { status: 400 });
    }

    const newAchievement = new Achievement({ friendlyName, name, badge });
    await newAchievement.save();

    return NextResponse.json({ message: 'Achievement created', achievement: newAchievement }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/achievements] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (name) {
      const achievement = await Achievement.findOne({ name });
      if (!achievement) {
        return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
      }
      return NextResponse.json({ achievement });
    }

    const achievements = await Achievement.find();
    return NextResponse.json({ achievements });

  } catch (error) {
    console.error('Failed to fetch achievements:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
