// app/api/billing/confirm/route.ts
//
// Called after the brand admin successfully completes the Stripe Elements
// card setup flow. Saves the payment method details to our StripeCustomer
// record for display and future off-session charges.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import { StripeCustomer } from '@/app/models/StripeCustomer';
import { logError } from '@/lib/sentry/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.adminLocationId) {
      return NextResponse.json({ error: 'No admin location found.' }, { status: 403 });
    }

    const { setupIntentId } = await req.json();
    if (!setupIntentId) {
      return NextResponse.json({ error: 'setupIntentId is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // Retrieve the completed SetupIntent from Stripe to get the payment method.
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment method setup did not complete successfully.' },
        { status: 400 }
      );
    }

    const paymentMethodId = setupIntent.payment_method as string;

    // Fetch payment method details for display (last 4, brand, expiry).
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const card = paymentMethod.card;
    const bankAccount = paymentMethod.us_bank_account;

    // Set as the default payment method on the Stripe customer.
    await stripe.customers.update(setupIntent.customer as string, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Save to our StripeCustomer record.
    const updated = await StripeCustomer.findOneAndUpdate(
      { clientId: user.adminLocationId },
      {
        $set: {
          stripePaymentMethodId: paymentMethodId,
          // Card fields — set to undefined when it's a bank account
          cardLast4: card?.last4 ?? null,
          cardBrand: card?.brand ?? null,
          cardExpMonth: card?.exp_month ?? null,
          cardExpYear: card?.exp_year ?? null,
          // Bank fields — set to undefined when it's a card
          bankLast4: bankAccount?.last4 ?? null,
          bankName: bankAccount?.bank_name ?? null,
        },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Billing record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      cardLast4: card?.last4,
      cardBrand: card?.brand,
      cardExpMonth: card?.exp_month,
      cardExpYear: card?.exp_year,
      bankLast4: bankAccount?.last4,
      bankName: bankAccount?.bank_name,
    });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/billing/confirm' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}