
// app/api/admin/rewards-log/route.ts
//
// Superadmin-only. Returns paginated RewardProcessingLog entries
// with optional filters: level, category, clientId, userId, dateFrom, dateTo.

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { RewardProcessingLog } from '@/app/models/RewardProcessingLog';
import Client from '@/app/models/Client';
import User from '@/app/models/User';
import { logError } from '@/lib/sentry/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const level     = searchParams.get('level');
    const category  = searchParams.get('category');
    const clientId  = searchParams.get('clientId');
    const userId    = searchParams.get('userId');
    const dateFrom  = searchParams.get('dateFrom');
    const dateTo    = searchParams.get('dateTo');
    const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit     = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const skip      = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (level && level !== 'all')    filter.level    = level;
    if (category && category !== 'all') filter.category = category;
    if (clientId)  filter.clientId  = clientId;
    if (userId)    filter.userId    = userId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo)   dateFilter.$lte = new Date(dateTo);
      filter.createdAt = dateFilter;
    }

    const [records, total] = await Promise.all([
      RewardProcessingLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RewardProcessingLog.countDocuments(filter),
    ]);

    // Attach client and user names for display
    const clientIds = [...new Set(records.filter(r => r.clientId).map(r => r.clientId!.toString()))];
    const userIds   = [...new Set(records.map(r => r.userId.toString()))];

    const [clients, users] = await Promise.all([
      Client.find({ _id: { $in: clientIds } }).select('name').lean(),
      User.find({ _id: { $in: userIds } }).select('name email').lean(),
    ]);

    const clientNameMap = new Map((clients as any[]).map(c => [c._id.toString(), c.name]));
    const userNameMap   = new Map((users as any[]).map(u => [u._id.toString(), u.name || u.email]));

    const enriched = records.map(r => ({
      ...r,
      clientName: r.clientId ? (clientNameMap.get(r.clientId.toString()) ?? r.clientId.toString()) : null,
      playerName: userNameMap.get(r.userId.toString()) ?? r.userId.toString(),
    }));

    // Summary counts across all records (unfiltered by pagination)
    const [summary] = await RewardProcessingLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          countInfo:       { $sum: { $cond: [{ $eq: ['$level', 'info'] },  1, 0] } },
          countWarn:       { $sum: { $cond: [{ $eq: ['$level', 'warn'] },  1, 0] } },
          countError:      { $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] } },
          countAuthErrors: { $sum: { $cond: [{ $eq: ['$category', 'auth_error'] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json({
      records: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summary ?? { countInfo: 0, countWarn: 0, countError: 0, countAuthErrors: 0 },
    });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/admin/rewards-log' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}