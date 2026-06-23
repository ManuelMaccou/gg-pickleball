// app/api/billing/setup/route.ts
//
// Handles Stripe billing setup for brand admins (custom app mode only).
//
// GET  — returns current billing status for the logged-in brand admin's client.
//         Called on mount by /admin/brand/billing/payment-method to determine
//         whether to show the setup flow or the existing payment method.
//
// POST — creates (or retrieves) a Stripe Customer for the client, then creates
//         a SetupIntent so the brand admin can securely save their card or bank
//         account via Stripe Elements. Returns the clientSecret.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import Client from '@/app/models/Client';
import { logError } from '@/lib/sentry/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ── GET — billing status ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    await connectToDatabase();

    const stripeCustomer = await StripeCustomer.findOne({
      clientId: user.adminLocationId,
    }).lean();

    if (!stripeCustomer) {
      return NextResponse.json({ configured: false });
    }

    return NextResponse.json({
      configured: !!stripeCustomer.stripePaymentMethodId,
      billingEmail: stripeCustomer.billingEmail,
      cardLast4: stripeCustomer.cardLast4,
      cardBrand: stripeCustomer.cardBrand,
      cardExpMonth: stripeCustomer.cardExpMonth,
      cardExpYear: stripeCustomer.cardExpYear,
      bankLast4: stripeCustomer.bankLast4,
      bankName: stripeCustomer.bankName,
    });
  } catch (err) {
    logError(err, { endpoint: 'GET /api/billing/setup' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── POST — create SetupIntent ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    const body = await req.json();
    const { billingEmail } = body;

    if (!billingEmail || !billingEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid billing email is required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const client = await Client.findById(user.adminLocationId)
      .select('name')
      .lean() as { name: string } | null;

    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    let stripeCustomerRecord = await StripeCustomer.findOne({
      clientId: user.adminLocationId,
    });

    let stripeCustomerId: string;

    if (stripeCustomerRecord) {
      stripeCustomerId = stripeCustomerRecord.stripeCustomerId;
      if (stripeCustomerRecord.billingEmail !== billingEmail) {
        await stripe.customers.update(stripeCustomerId, { email: billingEmail });
        stripeCustomerRecord.billingEmail = billingEmail;
        await stripeCustomerRecord.save();
      }
    } else {
      const stripeCustomer = await stripe.customers.create({
        email: billingEmail,
        name: client.name,
        metadata: { clientId: user.adminLocationId },
      });
      stripeCustomerId = stripeCustomer.id;

      stripeCustomerRecord = await StripeCustomer.create({
        clientId: user.adminLocationId,
        stripeCustomerId,
        billingEmail,
      });
    }

    // SetupIntent with off_session usage so we can charge without the
    // customer being present (commission billing runs via cron).
    // Using automatic_payment_methods rather than an explicit list so Stripe
    // only presents payment methods that are actually enabled on this account.
    // Explicitly listing 'us_bank_account' causes a PaymentElement load error
    // unless Financial Connections is fully configured on the Stripe account.
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card', 'us_bank_account'],
      usage: 'off_session',
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/billing/setup' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}