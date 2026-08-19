import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import PlayersUploadPreview from '@/app/models/PlayersUploadPreview';
import { validatePlayerRow } from '@/lib/programs/validatePlayerRow';
import { applyDuprIdDuplicateWarnings } from '@/lib/programs/applyDuprIdDuplicateWarnings';

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

  const preview = await PlayersUploadPreview.findOne({ programId });
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

  // Merge: any field omitted from the request body keeps its current value
  // rather than being wiped — a partial edit (e.g. just fixing the email)
  // shouldn't require resending the whole row.
  const merged = {
    name: body.name !== undefined ? body.name : current.name,
    email: body.email !== undefined ? body.email : current.email,
    duprId: body.duprId !== undefined ? body.duprId : current.duprId,
    dateOfBirth: body.dateOfBirth !== undefined ? body.dateOfBirth : current.dateOfBirth,
    age: body.age !== undefined ? body.age : current.age,
  };

  const validated = validatePlayerRow(merged);

  preview.rows[rowIndex] = {
    rowNumber,
    ...validated,
    // Reset here — recomputed for the whole file below, since only
    // duplicate-DUPR-ID warnings exist today and re-deriving from scratch
    // is simpler and safer than trying to selectively preserve/update.
    // Revisit if a second warning type is ever added.
    warnings: [],
  } as typeof current;

  applyDuprIdDuplicateWarnings(preview.rows);

  preview.markModified('rows');
  await preview.save();

  const errorRowCount = preview.rows.filter((r) => r.validationErrors.length > 0).length;
  const under13Count = preview.rows.filter((r) => r.isUnder13).length;

  return NextResponse.json({
    previewId: preview._id.toString(),
    fileErrors: preview.fileErrors,
    totalRows: preview.rows.length,
    errorRowCount,
    under13Count,
    confirmedAt: null,
    rows: preview.rows,
  });
}