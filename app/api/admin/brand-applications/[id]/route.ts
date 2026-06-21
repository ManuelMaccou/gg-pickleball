// app/api/admin/brand-applications/[id]/route.ts
//
// Superadmin endpoint to approve or reject a brand application.
//
// PATCH body: { action: 'approve' } | { action: 'reject', reviewNote?, sendEmail? }

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { BrandApplication } from '@/app/models/BrandApplication';
import User from '@/app/models/User';
import { createBrandClient } from '@/lib/admin/createBrandClient';
import { inviteAdminToClient } from '@/lib/admin/inviteAdminToClient';
import { sendNotificationEmail } from '@/lib/mailgun/sendNotificationEmail';
import { logError } from '@/lib/sentry/logger';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user?.superAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid application ID' }, { status: 400 });
    }

    const body = await req.json();
    const { action, reviewNote, sendEmail } = body;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const application = await BrandApplication.findById(id);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (application.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${action} an application with status "${application.status}".` },
        { status: 400 }
      );
    }

    // Get the applicant user for their name
    const applicant = await User.findById(application.userId);
    if (!applicant) {
      return NextResponse.json({ error: 'Applicant user not found' }, { status: 404 });
    }

    // Get the reviewing admin's User id for the audit field
    const reviewerUser = await User.findById(user.id);

    // ── APPROVE ──────────────────────────────────────────────────────────
    if (action === 'approve') {
      // 1. Create the brand Client
      let client;
      try {
        client = await createBrandClient({ name: application.brandName! });
      } catch (err: any) {
        const errorId = logError(err, { endpoint: 'UNKNOWN /api/admin/brand-applications/[id]' });
        return NextResponse.json({ errorId, error: err.message }, { status: 409 });
      }

      // 2. Invite the admin (creates admin link, sends password-set email if needed)
      try {
        await inviteAdminToClient({
          client,
          email: application.email,
          name: applicant.name,
        });
      } catch (err: any) {
        const errorId = logError(err, {
          endpoint: `PATCH /api/admin/brand-applications/${id}`,
          task: 'inviteAdminToClient on approval',
        });
        return NextResponse.json(
          { errorId, 
            error: 'Client created but inviting the admin failed. Please retry the invite manually.',
            clientId: client._id,
          },
          { status: 500 }
        );
      }

      // 3. Mark the application approved
      application.status = 'approved';
      application.reviewedAt = new Date();
      if (reviewerUser?._id) application.reviewedBy = reviewerUser._id;
      application.clientId = client._id;
      if (reviewNote) application.reviewNote = reviewNote;
      await application.save();

      return NextResponse.json({ success: true, application });
    }

    // ── REJECT ───────────────────────────────────────────────────────────
    application.status = 'rejected';
    application.reviewedAt = new Date();
    if (reviewerUser?._id) application.reviewedBy = reviewerUser._id;
    if (reviewNote) application.reviewNote = reviewNote;
    await application.save();

    // Optional rejection email
    if (sendEmail === true) {
      try {
        await sendNotificationEmail({
          email: application.email,
          template: 'gg_brand_application_decision',
          subject: `Update on your GG Pickleball application`,
          variables: {
            headline: `Update on your application`,
            brand_name: application.brandName ?? '',
            decision: 'rejected',
            body_text: reviewNote
              ? `Thank you for your interest in joining GG Pickleball. After reviewing your application for ${application.brandName}, we won't be moving forward at this time. ${reviewNote}`
              : `Thank you for your interest in joining GG Pickleball. After reviewing your application for ${application.brandName}, we won't be moving forward at this time.`,
          },
        });
      } catch (emailErr) {
        logError(emailErr, {
          endpoint: `PATCH /api/admin/brand-applications/${id}`,
          task: 'sending rejection email',
        });
      }
    }

    return NextResponse.json({ success: true, application });
  } catch (err: any) {
    const errorId = logError(err, { endpoint: `PATCH /api/admin/brand-applications/[id]` });
    return NextResponse.json(
      { errorId, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}