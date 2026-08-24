import { ProgramApplication } from '@/app/models/ProgramApplication';
import connectToDatabase from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';

function getClientIp(request: NextRequest): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, title, club, programName, programStartDate, programEndDate,
      email, phone, authorityConfirmed, disclosureConfirmed,
    } = body ?? {};

    if (
      !name || !title || !club || !programName ||
      !programStartDate || !programEndDate ||
      !email || !phone || !authorityConfirmed || !disclosureConfirmed
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields.' },
        { status: 400 },
      );
    }

    if (programEndDate < programStartDate) {
      return NextResponse.json(
        { success: false, error: "End date can't be before the start date." },
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
      programStartDate,
      programEndDate,
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