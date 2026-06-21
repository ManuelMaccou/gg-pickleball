// app/api/brand/apply/submit/route.ts
//
// Finalizes a BrandApplication draft into 'pending' status.
// Validates all required fields, checks brand name collision, captures the
// legal acceptance audit trail required by Section 13 of the Brand Partner
// Agreement, and sends the "we received your application" email.

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0'
import connectToDatabase from '@/lib/mongodb';
import User from '@/app/models/User';
import Client from '@/app/models/Client';
import { BrandApplication } from '@/app/models/BrandApplication';
import { sendNotificationEmail } from '@/lib/mailgun/sendNotificationEmail';
import { rateLimit } from '@/lib/security/rateLimit';
import { logError } from '@/lib/sentry/logger';

const AGREEMENT_VERSION = '1.0';
const URL_REGEX = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([/?#].*)?$/i;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const ip = getClientIp(req);
    const limited = rateLimit({
      key: `brand-apply-submit:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      legalCompanyName,
      brandName,
      applicantTitle,
      website,
      description,
      shopifyConfirmed,
      authorityConfirmed,
      agreementAccepted,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────

    const cleanLegalName = (legalCompanyName || '').trim();
    const cleanBrandName = (brandName || '').trim();
    const cleanTitle = (applicantTitle || '').trim();
    const cleanWebsite = (website || '').trim();
    const cleanDescription = (description || '').trim();

    if (cleanLegalName.length < 2 || cleanLegalName.length > 200) {
      return NextResponse.json(
        { error: 'Legal company name must be between 2 and 200 characters.' },
        { status: 400 }
      );
    }

    if (cleanBrandName.length < 2 || cleanBrandName.length > 100) {
      return NextResponse.json(
        { error: 'Brand name must be between 2 and 100 characters.' },
        { status: 400 }
      );
    }

    if (cleanTitle.length < 2 || cleanTitle.length > 100) {
      return NextResponse.json(
        { error: 'Please enter your job title or role.' },
        { status: 400 }
      );
    }

    if (!URL_REGEX.test(cleanWebsite)) {
      return NextResponse.json(
        { error: 'Please enter a valid website URL.' },
        { status: 400 }
      );
    }

    if (cleanDescription.length < 30 || cleanDescription.length > 500) {
      return NextResponse.json(
        { error: 'Description must be between 30 and 500 characters.' },
        { status: 400 }
      );
    }

    if (shopifyConfirmed !== true) {
      return NextResponse.json(
        { error: 'Please confirm your store is on Shopify.' },
        { status: 400 }
      );
    }

    if (authorityConfirmed !== true) {
      return NextResponse.json(
        { error: 'Please confirm you have authority to bind your company to this agreement.' },
        { status: 400 }
      );
    }

    if (agreementAccepted !== true) {
      return NextResponse.json(
        { error: 'Please accept the Brand Partner Agreement to continue.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const dbUser = await User.findOne({ auth0Id: session.user.sub });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // ── Brand name collision check ─────────────────────────────────────────
    // Block if brand name is taken by an active Client OR a pending/approved
    // application from someone else OR a fresh draft from someone else.

    const existingClient = await Client.findOne({ name: cleanBrandName }).lean();
    if (existingClient) {
      return NextResponse.json(
        { error: 'This brand name is already in use.' },
        { status: 409 }
      );
    }

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const conflictingApplication = await BrandApplication.findOne({
      brandName: cleanBrandName,
      userId: { $ne: dbUser._id },
      $or: [
        { status: 'pending' },
        { status: 'approved' },
        { status: 'draft', createdAt: { $gt: sevenDaysAgo } },
      ],
    }).lean();

    if (conflictingApplication) {
      return NextResponse.json(
        { error: 'This brand name is already in use.' },
        { status: 409 }
      );
    }

    // ── Update draft to pending ───────────────────────────────────────────

    const draft = await BrandApplication.findOne({
      userId: dbUser._id,
      status: 'draft',
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'No draft application found. Please start over.' },
        { status: 404 }
      );
    }

    const acceptedAt = new Date();

    draft.legalCompanyName = cleanLegalName;
    draft.brandName = cleanBrandName;
    draft.applicantTitle = cleanTitle;
    draft.website = cleanWebsite;
    draft.description = cleanDescription;
    draft.shopifyConfirmed = true;
    draft.authorityConfirmed = true;
    draft.agreementAccepted = true;
    draft.status = 'pending';
    draft.submittedAt = acceptedAt;

    // Legal acceptance audit trail — Section 13
    draft.agreementVersion = AGREEMENT_VERSION;
    draft.acceptedAt = acceptedAt;
    draft.acceptedIp = ip;

    await draft.save();

    // ── Send confirmation email ───────────────────────────────────────────
    try {
      await sendNotificationEmail({
        email: dbUser.email,
        template: 'gg_brand_application_received',
        subject: `We received your application for ${cleanBrandName}`,
        variables: {
          headline: `Thanks for applying, ${dbUser.name}!`,
          brand_name: cleanBrandName,
          body_text: `We received your application for ${cleanBrandName} and our team will review it shortly. We'll get back to you within a few business days.`,
        },
      });
    } catch (emailErr) {
      console.error('[BrandApplySubmit] Confirmation email failed:', emailErr);
      logError(emailErr, {
        endpoint: 'POST /api/brand/apply/submit',
        task: 'sending confirmation email',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[BrandApplySubmit] Error:', err);
    const errorId = logError(err, { endpoint: 'POST /api/brand/apply/submit' });
    return NextResponse.json(
      { errorId, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}