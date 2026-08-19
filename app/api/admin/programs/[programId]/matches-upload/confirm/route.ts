// Destination: app/api/admin/programs/[programId]/matches-upload/confirm/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import SourceRewardConfig from '@/app/models/SourceRewardConfig';
import MatchesUploadPreview from '@/app/models/MatchesUploadPreview';
import { processMatchesUpload } from '@/lib/programs/processMatchesUpload';
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
  const preview = await MatchesUploadPreview.findOne({ programId });
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

  const anyRewardConfigExists = await SourceRewardConfig.exists({});
  if (!anyRewardConfigExists) {
    return NextResponse.json(
      {
        error:
          'No reward configuration exists yet. Set up at least one SourceRewardConfig entry before confirming — otherwise every match will process with no stats or rewards recorded at all.',
      },
      { status: 400 }
    );
  }

  const eligibleRowCount = preview.rows.filter((r) => r.validationErrors.length === 0).length;

  preview.confirmedAt = new Date();
  await preview.save();

  processMatchesUpload(preview._id.toString()).catch((err) => {
    logError(err, {
      endpoint: 'POST /api/admin/programs/[programId]/matches-upload/confirm',
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