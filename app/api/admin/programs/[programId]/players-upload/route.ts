// Destination: app/api/admin/programs/[programId]/players-upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Program from '@/app/models/Program';
import PlayersUploadPreview from '@/app/models/PlayersUploadPreview';
import { parsePlayersCsv } from '@/lib/programs/parsePlayersCsv';

interface Params {
  params: Promise<{ programId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const requestingUser = await User.findById(authorizedUser.id);
  if (!requestingUser?.superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId } = await params;
  const program = await Program.findById(programId);
  if (!program) {
    return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
  }

  const body = await req.json();
  const csvText: string | undefined = body?.csvText;
  if (!csvText || typeof csvText !== 'string') {
    return NextResponse.json({ error: 'csvText is required.' }, { status: 400 });
  }

  const { rows, fileErrors } = parsePlayersCsv(csvText);

  await PlayersUploadPreview.deleteMany({ programId });
  const preview = await PlayersUploadPreview.create({
    programId,
    rows,
    fileErrors,
  });

  const errorRowCount = rows.filter((r) => r.validationErrors.length > 0).length;
  const under13Count = rows.filter((r) => r.isUnder13).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors,
    totalRows: rows.length,
    errorRowCount,
    under13Count,
    confirmedAt: null,
    rows,
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const requestingUser = await User.findById(authorizedUser.id);
  if (!requestingUser?.superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId } = await params;
  const preview = await PlayersUploadPreview.findOne({ programId }).lean();

  if (!preview) {
    return NextResponse.json({ preview: null });
  }

  const eligibleRows = preview.rows.filter(
    (r) => !r.isUnder13 && r.validationErrors.length === 0 && r.duprId
  );
  const eligibleDuprIds = eligibleRows.map((r) => r.duprId as string);

  const existingUsers = await User.find({
    'dupr.id': { $in: eligibleDuprIds },
  })
    .select('dupr.id')
    .lean();
  const doneDuprIds = new Set(existingUsers.map((u) => u.dupr?.id).filter(Boolean));

  const totalEligible = eligibleRows.length;
  const processedCount = eligibleRows.filter((r) => doneDuprIds.has(r.duprId)).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors: preview.fileErrors,
    totalRows: preview.rows.length,
    errorRowCount: preview.rows.filter((r) => r.validationErrors.length > 0).length,
    under13Count: preview.rows.filter((r) => r.isUnder13).length,
    confirmedAt: preview.confirmedAt ?? null,
    totalEligible,
    processedCount,
    done: totalEligible > 0 && processedCount === totalEligible,
    rows: preview.rows,
  });
}