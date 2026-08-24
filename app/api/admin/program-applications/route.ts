import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import { ProgramApplication } from '@/app/models/ProgramApplication';
import Program from '@/app/models/Program';

export async function GET(req: NextRequest) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const requestingUser = await User.findById(authorizedUser.id);
  if (!requestingUser?.superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const applications = await ProgramApplication.find({ status: 'approved' })
    .sort({ programStartDate: 1 })
    .lean();

  const applicationIds = applications.map((a) => a._id);
  const existingPrograms = await Program.find({
    programApplicationId: { $in: applicationIds },
  }).lean();

  const programByApplicationId = new Map(
    existingPrograms.map((p) => [p.programApplicationId.toString(), p])
  );

  const results = applications.map((application) => {
    const program = programByApplicationId.get(application._id.toString());
    return {
      applicationId: application._id.toString(),
      programName: application.programName,
      club: application.club,
      programStartDate: application.programStartDate,
      programEndDate: application.programEndDate,
      submittedAt: application.submittedAt,
      submittedByName: application.name,
      submittedByTitle: application.title,
      submittedByEmail: application.email,
      submittedByPhone: application.phone,
      program: program
        ? {
            id: program._id.toString(),
            name: program.name,
            date: program.date,
            club: program.club,
          }
        : null,
    };
  });

  return NextResponse.json({ applications: results });
}