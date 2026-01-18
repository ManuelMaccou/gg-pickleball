import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Match from '@/app/models/Match';
import Client from '@/app/models/Client';
import { FilterQuery, Types } from 'mongoose';
import { IMatch } from '@/app/types/databaseTypes';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const limitParam = searchParams.get('limit');
    const after = searchParams.get('after');
    const lastId = searchParams.get('lastId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    
    await connectToDatabase();
    
    // 1. Find all client IDs that are of type 'brand'
    const brandClients = await Client.find({ clientType: 'brand' }).select('_id').lean();
    const brandClientIds = brandClients.map(client => client._id);

    if (brandClientIds.length === 0) {
      // No brand clients exist, so no matches are possible.
      return NextResponse.json({ matches: [], hasNextPage: false });
    }

    // 2. Build the query to find matches for the user WITHIN those brand locations
    const conditions: FilterQuery<IMatch>[] = [
        { 
          $or: [
            { 'team1.players': new Types.ObjectId(userId!) },
            { 'team2.players': new Types.ObjectId(userId!) }
          ]
        },
        {
          location: { $in: brandClientIds }
        }
    ];

    if (after && lastId) {
      conditions.push({
        $or: [
          { matchDate: { $lt: new Date(after) } },
          {
            matchDate: new Date(after),
            _id: { $lt: new Types.ObjectId(lastId) }
          }
        ]
      });
    }

    const query: FilterQuery<IMatch> = {
      $and: conditions
    };
    
    // 4. Fetch one extra document to check for a next page
    const matches = await Match.find(query)
      .sort({ matchDate: -1, _id: -1 })
      .limit(limit + 1)
      .populate('team1.players', 'name')
      .populate('team2.players', 'name')
      .populate('winners', 'name')
      .lean();

    let hasNextPage = false;
    if (matches.length > limit) {
      hasNextPage = true;
      matches.pop(); // Remove the extra match before sending
    }

    return NextResponse.json({ matches, hasNextPage });
  } catch (error) {
    console.error('Error fetching brand-wide user matches:', error);
    // Remember to add your Sentry logging here if needed
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}