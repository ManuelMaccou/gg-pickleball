import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose'
import { logError } from '@/lib/sentry/logger';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { IClient } from '@/app/types/databaseTypes';

export async function PATCH(req: NextRequest) {
  const user = await getAuthorizedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const { clientId, ...updateData } = await req.json();

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      logError(new Error('Invalid or missing client ID for PATCH'), {
        endpoint: 'PATCH /api/client',
        task: 'Updating a client'
      });
      return NextResponse.json({ error: 'Invalid or missing client ID' }, { status: 400 });
    }

    const allowedUpdates: (keyof IClient)[] = [
      'name', 'logo', 'admin_logo', 'icon', 'latitude', 'longitude', 
      'rewardProducts', 'retailSoftware', 'reservationSoftware', 
      'shopify', 'podplay', 'playbypoint'
    ];

    const sanitizedUpdateData = Object.keys(updateData)
      .filter((key): key is keyof IClient => (allowedUpdates as string[]).includes(key))
      .reduce((acc, key) => {
        if (updateData[key] !== undefined) {
          acc[key] = updateData[key];
        }
        return acc;
      }, {} as Partial<IClient>);

    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      { $set: sanitizedUpdateData },
      { new: true, runValidators: true }
    );

    if (!updatedClient) {
      logError(new Error(`Client not found with id: ${clientId}`), {
        endpoint: 'PATCH /api/client',
        task: 'Updating a client'
      });
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client updated successfully', client: updatedClient });

  } catch (error) {
    logError(error, { message: 'Error updating Client.' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}