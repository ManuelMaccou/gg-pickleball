import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import PlayersUploadPreview from '@/app/models/PlayersUploadPreview';
import { processPlayersUpload } from '@/lib/programs/processPlayersUpload';
import { logError } from '@/lib/sentry/logger';

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
  const preview = await PlayersUploadPreview.findOne({ programId });
  if (!preview) {
    return NextResponse.json(
      { error: 'No preview to confirm. Upload a CSV first.' },
      { status: 404 }
    );
  }

  if (preview.fileErrors.length > 0) {
    return NextResponse.json(
      { error: 'This file has errors and cannot be confirmed. Fix and re-upload.' },
      { status: 400 }
    );
  }

  const rowsWithErrors = preview.rows.filter((r) => r.validationErrors.length > 0);
  if (rowsWithErrors.length > 0) {
    return NextResponse.json(
      {
        error: `${rowsWithErrors.length} row(s) have errors and must be fixed before confirming.`,
        rowNumbers: rowsWithErrors.map((r) => r.rowNumber),
      },
      { status: 400 }
    );
  }

  const eligibleRowCount = preview.rows.filter(
    (r) => !r.isUnder13 && r.duprId && r.name && r.email
  ).length;

  // Set and saved BEFORE firing the background task — a GET that lands
  // immediately after this response needs to already see this preview as
  // confirmed, not racing against the background loop's own writes.
  preview.confirmedAt = new Date();
  await preview.save();

  // Fire-and-forget — deliberately not awaited. Any top-level failure
  // (e.g. DB connection lost mid-loop) is logged, not thrown back to a
  // response nobody is waiting on anymore.
  processPlayersUpload(preview._id.toString()).catch((err) => {
    logError(err, {
      endpoint: 'POST /api/admin/programs/[programId]/players-upload/confirm',
      programId,
      previewId: preview._id.toString(),
    });
  });

  return NextResponse.json({
    message: 'Processing started.',
    eligibleRowCount,
    confirmedAt: preview.confirmedAt,
  });
}