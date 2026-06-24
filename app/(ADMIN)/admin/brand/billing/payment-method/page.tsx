'use client';

// app/(ADMIN)/admin/brand/billing/payment-method/page.tsx
//
// Stripe payment method setup page for brand admins (custom app mode only).
// Reached via two paths:
//   1. OAuth install flow: callback redirects here after token exchange
//      (in custom mode, replaces the Shopify pricing page redirect)
//   2. Direct navigation: brand admin updates their payment method
//
// After saving a card/bank account, redirects to /admin/brand so the
// dashboard can confirm hasActivePlan: true via shopify-status.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Button, Card, Callout, Flex, Heading,
  Separator, Spinner, Text, TextField, Badge,
} from '@radix-ui/themes';
import { useUserContext } from '@/app/contexts/UserContext';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { CheckCircledIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import darkGgLogo from '../../../../../../public/logos/gg_logo_black_transparent.png';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
};

// ── Step 2: Payment details form — must be inside <Elements> ─────────────────

function PaymentSetupForm({
  onSuccess,
}: {
  onSuccess: (data: {
    cardLast4?: string;
    cardBrand?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
    bankLast4?: string;
    bankName?: string;
  }) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSaving(true);
    setError(null);

    try {
      const { setupIntent, error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/admin/brand/billing/payment-method`,
        },
        redirect: 'if_required',
      });

      if (stripeError) throw new Error(stripeError.message);
      if (!setupIntent?.id) throw new Error('Setup did not complete.');

      const confirmRes = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: setupIntent.id }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error ?? 'Failed to save payment method.');

      onSuccess(confirmData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex direction="column" gap="4">
      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      <Box>
        <Text size="2" weight="medium" mb="1">Payment details </Text>
        <Text size="1" color="gray" mb="2">
          Your payment method will be charged automatically when commissions are due.
        </Text>
        <Box
          style={{
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            padding: '12px',
            backgroundColor: 'white',
          }}
        >
          <PaymentElement />
        </Box>
      </Box>

      <Button
        onClick={handleSubmit}
        disabled={saving || !stripe}
        style={{ width: 'fit-content' }}
      >
        {saving && <Spinner size="1" />}
        {saving ? 'Saving…' : 'Save payment method'}
      </Button>
    </Flex>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentMethodPage() {
  const { user } = useUserContext();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [billingStatus, setBillingStatus] = useState<{
    configured: boolean;
    billingEmail?: string;
    cardLast4?: string;
    cardBrand?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
    bankLast4?: string;
    bankName?: string;
  } | null>(null);

  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Step 1 — collect billing email
  const [billingEmail, setBillingEmail] = useState('');
  const [initializingSetup, setInitializingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Step 2 — Stripe Elements clientSecret
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login?returnTo=/admin/brand/billing/payment-method');
      return;
    }
    fetch('/api/billing/setup')
      .then((r) => r.json())
      .then((data) => {
        setBillingStatus(data);
        if (data.billingEmail) setBillingEmail(data.billingEmail);
      })
      .catch(() => setBillingStatus({ configured: false }))
      .finally(() => setLoading(false));
  }, [user, router]);

  const handleInitializeSetup = async () => {
    if (!billingEmail || !billingEmail.includes('@')) {
      return setSetupError('Please enter a valid billing email.');
    }
    setInitializingSetup(true);
    setSetupError(null);
    try {
      const res = await fetch('/api/billing/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Setup failed.');
      setClientSecret(data.clientSecret);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Setup failed.');
    } finally {
      setInitializingSetup(false);
    }
  };

  // Called after PaymentSetupForm completes — redirect to dashboard
  const handlePaymentSaved = (data: {
    cardLast4?: string;
    cardBrand?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
    bankLast4?: string;
    bankName?: string;
  }) => {
    setBillingStatus({
      configured: true,
      billingEmail,
      ...data,
    });
    setShowUpdateForm(false);
    setClientSecret(null);

    // Redirect to dashboard — shopify-status will confirm hasActivePlan: true
    router.push('/admin/brand');
  };

  const handleCancelUpdate = () => {
    setShowUpdateForm(false);
    setClientSecret(null);
    setSetupError(null);
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    );
  }

  const showSetupFlow = !billingStatus?.configured || showUpdateForm;

  return (
    <Flex direction="column" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <Flex
        justify="between"
        align="center"
        height="64px"
        px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}
      >
        <Flex align="center" gap="4">
          <Image
            src={darkGgLogo}
            alt="Logo"
            height={32}
            width={60}
            style={{ objectFit: 'contain' }}
          />
          <Separator orientation="vertical" style={{ height: 20 }} />
          <Text weight="bold" size="3">Payment Setup</Text>
        </Flex>
        <Button variant="soft" color="gray" onClick={() => router.push('/admin/brand')}>
          ← Dashboard
        </Button>
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="6" style={{ maxWidth: 600, margin: '0 auto' }}>
          <Heading size="6">Set Up Billing</Heading>

          <Card size="3">
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="4">Payment Method</Heading>
                {billingStatus?.configured && !showUpdateForm && (
                  <Badge color="green" variant="soft">
                    <CheckCircledIcon /> Active
                  </Badge>
                )}
              </Flex>

              {/* ── Existing payment method display ── */}
              {billingStatus?.configured && !showUpdateForm && (
                <>
                  <Flex direction="column" gap="2">
                    {billingStatus.cardLast4 ? (
                      <Flex align="center" gap="3">
                        <Text size="3" weight="medium">
                          {CARD_BRAND_LABELS[billingStatus.cardBrand ?? ''] ?? billingStatus.cardBrand}
                        </Text>
                        <Text size="3">•••• {billingStatus.cardLast4}</Text>
                        <Text size="2" color="gray">
                          Expires {billingStatus.cardExpMonth}/{billingStatus.cardExpYear}
                        </Text>
                      </Flex>
                    ) : billingStatus.bankLast4 ? (
                      <Flex align="center" gap="3">
                        <Text size="3" weight="medium">{billingStatus.bankName ?? 'Bank account'}</Text>
                        <Text size="3">•••• {billingStatus.bankLast4}</Text>
                      </Flex>
                    ) : (
                      <Text size="2" color="gray">Payment method on file</Text>
                    )}
                    <Text size="2" color="gray">
                      Invoices sent to: {billingStatus.billingEmail}
                    </Text>
                  </Flex>
                  <Button
                    variant="soft"
                    color="gray"
                    onClick={() => setShowUpdateForm(true)}
                    style={{ width: 'fit-content' }}
                  >
                    Update payment method
                  </Button>
                </>
              )}

              {/* ── Setup flow ── */}
              {showSetupFlow && (
                <>
                  {!billingStatus?.configured && (
                    <Callout.Root color="amber" size="1">
                      <Callout.Text>
                        Add a payment method to enable reward code generation for your customers.
                        Commissions are collected automatically 30 days after each sale.
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {/* Step 1 — email */}
                  {!clientSecret && (
                    <Flex direction="column" gap="3">
                      {setupError && (
                        <Callout.Root color="red" size="1">
                          <Callout.Text>{setupError}</Callout.Text>
                        </Callout.Root>
                      )}
                      <Box>
                        <Text size="2" weight="medium" mb="1">Billing email </Text>
                        <Text size="1" color="gray" mb="2">
                          Invoices will be sent here each billing cycle.
                        </Text>
                        <TextField.Root
                          type="email"
                          value={billingEmail}
                          onChange={(e) => setBillingEmail(e.target.value)}
                          placeholder="billing@yourcompany.com"
                          onKeyDown={(e) => e.key === 'Enter' && handleInitializeSetup()}
                        />
                      </Box>
                      <Flex gap="5" align="center">
                        <Button
                          onClick={handleInitializeSetup}
                          disabled={initializingSetup}
                          style={{ width: 'fit-content' }}
                        >
                          {initializingSetup && <Spinner size="1" />}
                          {initializingSetup ? 'Setting up…' : 'Continue'}
                        </Button>
                        {showUpdateForm && (
                          <Button variant="ghost" color="gray" onClick={handleCancelUpdate}>
                            Cancel
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                  )}

                  {/* Step 2 — payment details */}
                  {clientSecret && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            fontSizeBase: '14px',
                            colorText: '#1a1a1a',
                            colorTextPlaceholder: '#6b7280',
                          },
                        },
                      }}
                    >
                      <PaymentSetupForm onSuccess={handlePaymentSaved} />
                    </Elements>
                  )}
                </>
              )}
            </Flex>
          </Card>

          {/* How billing works */}
          <Card size="3">
            <Flex direction="column" gap="3">
              <Heading size="4">How billing works</Heading>
              <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
                GG Pickleball charges a{' '}
                <Text weight="bold" style={{ color: 'var(--slate-12)' }}>5% commission</Text>{' '}
                on sales made using promo codes issued through the platform.
              </Text>
              <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
                Commissions are collected 30 days after each sale to account for returns
                and chargebacks. You'll receive an itemized invoice by email before each charge.
              </Text>
              <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
                If a return or dispute is initiated within 30 days of a sale, that
                order's commission is adjusted or waived accordingly.
              </Text>
            </Flex>
          </Card>
        </Flex>
      </Box>
    </Flex>
  );
}