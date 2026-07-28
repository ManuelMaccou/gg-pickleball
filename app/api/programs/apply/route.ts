import { ProgramApplication } from '@/app/models/ProgramApplication';
import connectToDatabase from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';

function getClientIp(request: NextRequest): string {
  // TEMP DEBUG — remove once you've confirmed which header actually carries
  // the real client IP on your Railway setup. Compare these against
  // whatismyipaddress.com for a real test submission.
  console.log('[ProgramApplication] IP-related headers:', {
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'x-real-ip': request.headers.get('x-real-ip'),
    'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
    'true-client-ip': request.headers.get('true-client-ip'),
    'fastly-client-ip': request.headers.get('fastly-client-ip'),
  });

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, title, club, programName, programDate,
      email, phone, authorityConfirmed, disclosureConfirmed,
    } = body ?? {};

    if (
      !name || !title || !club || !programName || !programDate ||
      !email || !phone || !authorityConfirmed || !disclosureConfirmed
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields.' },
        { status: 400 },
      );
    }

    const ipAddress = getClientIp(request);

    await connectToDatabase();
    await ProgramApplication.create({
      name,
      title,
      club,
      programName,
      programDate: new Date(programDate),
      email,
      phone,
      authorityConfirmed: Boolean(authorityConfirmed),
      disclosureConfirmed: Boolean(disclosureConfirmed),
      ipAddress,
      status: 'pending',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ProgramApplication] submission failed', err);
    return NextResponse.json(
      { success: false, error: 'Something went wrong on our end. Please try again.' },
      { status: 500 },
    );
  }
}