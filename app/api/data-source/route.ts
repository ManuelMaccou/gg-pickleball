import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { logError } from '@/lib/sentry/logger';
import DataSource from '@/app/models/DataSource';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { IDataSource } from '@/app/types/databaseTypes';

export async function GET() {
  try {
    await connectToDatabase();

    const dataSources = await DataSource.find({ active: true }).lean();

    return NextResponse.json({ dataSources });
  } catch (error) {
    const errorId = logError(error, { 
      message: 'Failed to fetch DataSources' ,
      endpoint: 'GET /api/data-source'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization: Ensure only an authorized admin can create a data source.
    const authorizedUser = await getAuthorizedUser(req);
   if (authorizedUser?.superAdmin === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 2. Get and Validate the Request Body
    const body: Partial<IDataSource> = await req.json();
    const { name, type, icon, logo } = body;

    if (!name || !type || !icon || !logo) {
      return NextResponse.json({ error: 'Missing required fields: name, type, icon, and logo are required.' }, { status: 400 });
    }

    await connectToDatabase();

    // 3. Create and Save the New Data Source
    const newDataSource = new DataSource({
      name,
      type,
      icon,
      logo,
      credentials: body.credentials,
      active: body.active ?? false,
    });

    const savedDataSource = await newDataSource.save();

    // 4. Respond with the newly created document
    return NextResponse.json({ dataSource: savedDataSource }, { status: 201 });

  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 11000
    ) {
      const errorId = logError(error, { 
        message: `Attempted to create a duplicate DataSource.`,
        endpoint: 'POST /api/data-source'
      });
      return NextResponse.json({ errorId, error: 'A data source with that name or type already exists.' }, { status: 409 });
    }

    const errorId = logError(error, { 
      message: 'Failed to create DataSource',
      endpoint: 'POST /api/data-source'
    });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}