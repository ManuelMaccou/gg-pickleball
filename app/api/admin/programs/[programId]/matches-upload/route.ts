import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Program from '@/app/models/Program';
import MatchesUploadPreview from '@/app/models/MatchesUploadPreview';
import { parseMatchesCsv } from '@/lib/programs/parseMatchesCsv';
import { enrichMatchRows } from '@/lib/programs/enrichMatchRows';

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

  const { rows, fileErrors } = parseMatchesCsv(csvText);

  await MatchesUploadPreview.deleteMany({ programId });
  const preview = await MatchesUploadPreview.create({
    programId,
    rows,
    fileErrors,
  });

  const enrichedRows = await enrichMatchRows(rows);
  const errorRowCount = rows.filter((r) => r.validationErrors.length > 0).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors,
    totalRows: rows.length,
    errorRowCount,
    confirmedAt: null,
    rows: enrichedRows,
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
  const preview = await MatchesUploadPreview.findOne({ programId }).lean();

  if (!preview) {
    return NextResponse.json({ preview: null });
  }

  const enrichedRows = await enrichMatchRows(preview.rows);

  const eligibleRows = preview.rows.filter((r) => r.validationErrors.length === 0);
  const totalEligible = eligibleRows.length;
  const processedCount = enrichedRows.filter(
    (r) => r.validationErrors.length === 0 && r.alreadyProcessed
  ).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors: preview.fileErrors,
    totalRows: preview.rows.length,
    errorRowCount: preview.rows.filter((r) => r.validationErrors.length > 0).length,
    confirmedAt: preview.confirmedAt ?? null,
    totalEligible,
    processedCount,
    done: totalEligible > 0 && processedCount === totalEligible,
    rows: enrichedRows,
  });
}