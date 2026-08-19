import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { ProgramApplication } from '@/app/models/ProgramApplication';
import Program from '@/app/models/Program';

// e.g. "Aug 22, 2026" (single day) / "Aug 22-24, 2026" (same month) /
// "Aug 30 - Sep 1, 2026" (crosses month) / "Dec 30, 2026 - Jan 2, 2027"
// (crosses year).
function formatProgramDateRange(startDateStr: string, endDateStr: string): string {
  const start = DateTime.fromISO(startDateStr);
  const end = DateTime.fromISO(endDateStr);

  if (!start.isValid || !end.isValid) {
    return `${startDateStr} - ${endDateStr}`;
  }
  if (start.hasSame(end, 'day')) {
    return start.toFormat('LLL d, yyyy');
  }
  if (start.hasSame(end, 'year')) {
    if (start.hasSame(end, 'month')) {
      return `${start.toFormat('LLL d')}-${end.toFormat('d, yyyy')}`;
    }
    return `${start.toFormat('LLL d')} - ${end.toFormat('LLL d, yyyy')}`;
  }
  return `${start.toFormat('LLL d, yyyy')} - ${end.toFormat('LLL d, yyyy')}`;
}

export async function POST(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const requestingUser = await User.findById(authorizedUser.id);
  if (!requestingUser?.superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { programApplicationId } = body ?? {};

  if (!programApplicationId) {
    return NextResponse.json(
      { error: 'programApplicationId is required.' },
      { status: 400 }
    );
  }

  const application = await ProgramApplication.findById(programApplicationId);
  if (!application) {
    return NextResponse.json(
      { error: 'Program application not found.' },
      { status: 404 }
    );
  }
  if (application.status !== 'approved') {
    return NextResponse.json(
      {
        error: `This application is "${application.status}", not approved. Approve it before creating a Program.`,
      },
      { status: 400 }
    );
  }

  const existingProgram = await Program.findOne({ programApplicationId });
  if (existingProgram) {
    return NextResponse.json({
      message: 'A Program already exists for this application.',
      program: {
        id: existingProgram._id.toString(),
        name: existingProgram.name,
        date: existingProgram.date,
        club: existingProgram.club,
      },
    });
  }

  const program = await Program.create({
    programApplicationId: application._id,
    name: application.programName,
    date: formatProgramDateRange(
      application.programStartDate,
      application.programEndDate
    ),
    club: application.club,
  });

  return NextResponse.json({
    message: 'Program created.',
    program: {
      id: program._id.toString(),
      name: program.name,
      date: program.date,
      club: program.club,
    },
  });
}