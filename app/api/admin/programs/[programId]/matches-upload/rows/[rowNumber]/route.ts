import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import MatchesUploadPreview from '@/app/models/MatchesUploadPreview';
import { validateMatchRow } from '@/lib/programs/validateMatchRow';
import { applySourceMatchIdDuplicateErrors } from '@/lib/programs/applySourceMatchIdDuplicateErrors';
import { enrichMatchRows } from '@/lib/programs/enrichMatchRows';

interface Params {
  params: Promise<{ programId: string; rowNumber: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authorizedUser = await getAuthorizedUser(req);
  if (!authorizedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const requestingUser = await User.findById(authorizedUser.id);
  if (!requestingUser?.superAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { programId, rowNumber: rowNumberParam } = await params;
  const rowNumber = Number(rowNumberParam);

  const preview = await MatchesUploadPreview.findOne({ programId });
  if (!preview) {
    return NextResponse.json({ error: 'No preview found for this program.' }, { status: 404 });
  }

  const rowIndex = preview.rows.findIndex((r) => r.rowNumber === rowNumber);
  if (rowIndex === -1) {
    return NextResponse.json({ error: `Row ${rowNumber} not found in this preview.` }, { status: 404 });
  }

  if (preview.confirmedAt) {
    return NextResponse.json(
      { error: 'This upload has already been confirmed and cannot be edited. Upload a new CSV instead.' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const current = preview.rows[rowIndex];

  const merged = {
    sourceMatchId: body.sourceMatchId !== undefined ? body.sourceMatchId : current.sourceMatchId,
    division: body.division !== undefined ? body.division : current.division,
    matchType: body.matchType !== undefined ? body.matchType : current.matchType,
    matchDate: body.matchDate !== undefined ? body.matchDate : current.matchDate,
    team1Score: body.team1Score !== undefined ? body.team1Score : current.team1Score,
    team2Score: body.team2Score !== undefined ? body.team2Score : current.team2Score,
    team1Player1DuprId:
      body.team1Player1DuprId !== undefined ? body.team1Player1DuprId : current.team1Player1DuprId,
    team1Player2DuprId:
      body.team1Player2DuprId !== undefined ? body.team1Player2DuprId : current.team1Player2DuprId,
    team2Player1DuprId:
      body.team2Player1DuprId !== undefined ? body.team2Player1DuprId : current.team2Player1DuprId,
    team2Player2DuprId:
      body.team2Player2DuprId !== undefined ? body.team2Player2DuprId : current.team2Player2DuprId,
  };

  const validated = validateMatchRow(merged);

  preview.rows[rowIndex] = { rowNumber, ...validated } as typeof current;

  applySourceMatchIdDuplicateErrors(preview.rows);

  preview.markModified('rows');
  await preview.save();

  const enrichedRows = await enrichMatchRows(preview.rows);
  const errorRowCount = preview.rows.filter((r) => r.validationErrors.length > 0).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors: preview.fileErrors,
    totalRows: preview.rows.length,
    errorRowCount,
    confirmedAt: null,
    rows: enrichedRows,
  });
}