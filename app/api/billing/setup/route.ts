// app/api/billing/setup/route.ts
//
// Handles Stripe billing setup for brand admins.
//
// POST — creates a Stripe Customer + SetupIntent so the brand admin
//         can securely save their card via Stripe Elements.
// GET  — returns the current billing status for the client
//         (whether a card is saved, last 4, etc.)

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
      bankLast4: (stripeCustomer as any).bankLast4,
      bankName: (stripeCustomer as any).bankName,
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

    // Look up the client name for Stripe customer metadata.
    const client = await Client.findById(user.adminLocationId)
      .select('name')
      .lean() as { name: string } | null;

    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    // Find or create the StripeCustomer record.
    let stripeCustomerRecord = await StripeCustomer.findOne({
      clientId: user.adminLocationId,
    });

    let stripeCustomerId: string;

    if (stripeCustomerRecord) {
      // Already have a Stripe customer — update email if changed.
      stripeCustomerId = stripeCustomerRecord.stripeCustomerId;
      if (stripeCustomerRecord.billingEmail !== billingEmail) {
        await stripe.customers.update(stripeCustomerId, { email: billingEmail });
        stripeCustomerRecord.billingEmail = billingEmail;
        await stripeCustomerRecord.save();
      }
    } else {
      // Create a new Stripe customer.
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

    // Create a SetupIntent — this is what Stripe Elements uses to
    // securely collect and save the card without an immediate charge.
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