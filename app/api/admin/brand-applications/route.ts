// app/api/admin/brand-applications/route.ts
//
// Superadmin-only endpoint for listing brand applications.
// Supports filtering by status (draft / pending / approved / rejected).

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { BrandApplication } from '@/app/models/BrandApplication';
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
    const status = searchParams.get('status') ?? 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [applications, total] = await Promise.all([
      BrandApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BrandApplication.countDocuments(filter),
    ]);

    // Hydrate user names
    const userIds = [...new Set(applications.map((a) => a.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email')
      .lean();
    const userMap = new Map(
      users.map((u) => [(u as any)._id.toString(), { name: (u as any).name, email: (u as any).email }])
    );

    const rows = applications.map((a) => ({
      ...a,
      userName: userMap.get(a.userId.toString())?.name ?? 'Unknown',
      userEmail: userMap.get(a.userId.toString())?.email ?? a.email,
    }));

    // Summary counts
    const [summary] = await BrandApplication.aggregate([
      {
        $group: {
          _id: null,
          countDraft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          countPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          countApproved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          countRejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json({
      applications: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summary ?? {
        countDraft: 0,
        countPending: 0,
        countApproved: 0,
        countRejected: 0,
      },
    });
  } catch (err: any) {
    logError(err, { endpoint: 'GET /api/admin/brand-applications' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}