import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  return NextResponse.json({ message: 'pong' });
}

export async function GET(req: Request) {
    return NextResponse.json({ message: 'pong from get' });
}