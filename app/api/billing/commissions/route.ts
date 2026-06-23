// app/api/billing/commissions/route.ts
//
// Returns CommissionRecords for the logged-in brand admin's client.
// Read-only — brand admins can view but not modify commissions.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      CommissionRecord.find({ clientId: user.adminLocationId })
        .sort({ orderCreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommissionRecord.countDocuments({ clientId: user.adminLocationId }),
    ]);

    // Summary totals for this client only.
    const [summary] = await CommissionRecord.aggregate([
      { $match: { clientId: user.adminLocationId } },
      {
        $group: {
          _id: null,
          totalCharged: {
            $sum: { $cond: [{ $eq: ['$status', 'charged'] }, '$commissionAmount', 0] },
          },
          totalPending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] },
          },
          countCharged: {
            $sum: { $cond: [{ $eq: ['$status', 'charged'] }, 1, 0] },
          },
          countPending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
        },
      },
    ]);

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: summary ?? {
        totalCharged: 0,
        totalPending: 0,
        countCharged: 0,
        countPending: 0,
      },
    });
  } catch (err) {
    const errorId = logError(err, { endpoint: 'GET /api/billing/commissions' });
    return NextResponse.json({ errorId, error: 'Internal error' }, { status: 500 });
  }
}