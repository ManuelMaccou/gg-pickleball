import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import RewardCode from '@/app/models/RewardCode';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { logError } from '@/lib/sentry/logger';
import { IClient } from '@/app/types/databaseTypes';

export async function GET(req: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser(req);
    if (authorizedUser?.permission !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

   const affiliateClients = await Client.find({ affiliateCode: { $exists: true, $ne: null } })
    .select('name affiliateCode')
    .lean<Pick<IClient, '_id' | 'name' | 'affiliateCode'>[]>();

    if (affiliateClients.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const counts = await RewardCode.aggregate([
      { $match: { clientId: { $in: affiliateClients.map((c) => c._id) } } },
      { $group: { _id: '$clientId', count: { $sum: 1 } } },
    ]);
    const countByClientId = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const rows = affiliateClients.map((c) => ({
      clientId: c._id.toString(),
      clientName: c.name,
      affiliateCode: c.affiliateCode,
      timesIssued: countByClientId.get(c._id.toString()) ?? 0,
    }));

    return NextResponse.json({ rows });
  } catch (error) {
    const errorId = logError(error, { endpoint: 'GET /api/admin/affiliate-usage' });
    return NextResponse.json({ errorId, error: 'Internal Server Error' }, { status: 500 });
  }
}