// app/api/admin/commissions/route.ts
//
// Superadmin-only endpoints for viewing and managing commission records.
//
// GET  — paginated list of all CommissionRecords with optional status filter
// PATCH — waive a specific commission record

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { CommissionRecord } from '@/app/models/CommissionRecord';
import Client from '@/app/models/Client';
import { logError } from '@/lib/sentry/logger';

// ── GET /api/admin/commissions ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // optional filter
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [records, total] = await Promise.all([
      CommissionRecord.find(filter)
        .sort({ chargeAfter: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommissionRecord.countDocuments(filter),
    ]);

    // Attach client names for display.
    const clientIds = [...new Set(records.map((r) => r.clientId.toString()))];
    const clients = await Client.find({ _id: { $in: clientIds } })
      .select('name')
      .lean();
    const clientNameMap = new Map(
      clients.map((c) => [(c as any)._id.toString(), (c as any).name as string])
    );

    const recordsWithClientName = records.map((r) => ({
      ...r,
      clientName: clientNameMap.get(r.clientId.toString()) ?? 'Unknown',
    }));

    // Summary stats across all records (not just this page).
    const [summary] = await CommissionRecord.aggregate([
      {
        $group: {
          _id: null,
          totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] } },
          totalHeld: { $sum: { $cond: [{ $eq: ['$status', 'held'] }, '$commissionAmount', 0] } },
          totalCharged: { $sum: { $cond: [{ $eq: ['$status', 'charged'] }, '$commissionAmount', 0] } },
          totalWaived: { $sum: { $cond: [{ $eq: ['$status', 'waived'] }, '$commissionAmount', 0] } },
          countPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          countHeld: { $sum: { $cond: [{ $eq: ['$status', 'held'] }, 1, 0] } },
          countCharged: { $sum: { $cond: [{ $eq: ['$status', 'charged'] }, 1, 0] } },
          countWaived: { $sum: { $cond: [{ $eq: ['$status', 'waived'] }, 1, 0] } },
          countReview: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json({
      records: recordsWithClientName,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summary ?? {
        totalPending: 0, totalHeld: 0, totalCharged: 0, totalWaived: 0,
        countPending: 0, countHeld: 0, countCharged: 0, countWaived: 0, countReview: 0,
      },
    });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/admin/commissions' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── PATCH /api/admin/commissions — waive a commission ────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { commissionId, action, note } = await req.json();

    if (!commissionId || !mongoose.isValidObjectId(commissionId)) {
      return NextResponse.json({ error: 'Valid commissionId is required.' }, { status: 400 });
    }

    if (action !== 'waive') {
      return NextResponse.json({ error: 'Action must be "waive".' }, { status: 400 });
    }

    await connectToDatabase();

    const record = await CommissionRecord.findById(commissionId);
    if (!record) {
      return NextResponse.json({ error: 'Commission record not found.' }, { status: 404 });
    }

    if (record.status === 'charged') {
      return NextResponse.json(
        { error: 'Cannot waive a commission that has already been charged.' },
        { status: 400 }
      );
    }

    if (record.status === 'waived') {
      return NextResponse.json(
        { error: 'This commission has already been waived.' },
        { status: 400 }
      );
    }

    const updated = await CommissionRecord.findByIdAndUpdate(
      commissionId,
      {
        $set: {
          status: 'waived',
          commissionAmount: 0,
          reviewNote: note ? `Manually waived: ${note}` : 'Manually waived by admin',
        },
      },
      { new: true }
    );

    return NextResponse.json({ record: updated });
  } catch (err) {
    logError(err, { endpoint: 'PATCH /api/admin/commissions' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}