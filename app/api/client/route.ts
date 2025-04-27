import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { IClient } from '@/app/types/databaseTypes';
import { Types } from 'mongoose'

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const { name, logo } = body as IClient;

    if (!name || !logo) {
      return NextResponse.json({ error: 'Name and logo are required' }, { status: 400 });
    }

    const newClient = new Client({ name, logo });
    await newClient.save();

    return NextResponse.json({ message: 'Client created', client: newClient }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/client] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('id')

    if (clientId) {
      if (!Types.ObjectId.isValid(clientId)) {
        return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
      }

      const client = await Client.findById(clientId)

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      return NextResponse.json({ client })
    }

    const clients = await Client.find()
    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Failed to fetch clients:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}