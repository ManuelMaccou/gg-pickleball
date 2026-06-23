'use client';

// app/(ADMIN)/admin/gg/onboard/page.tsx
//
// Superadmin-only. Custom app mode client onboarding — walks through every
// step needed to get a new brand partner live in one place.
//
// Step 1 — Create client (name only → POST /api/admin/onboard)
// Step 2 — Configure Shopify (shopDomain + envKey + installUrl → PATCH /api/admin/onboard)
//           + create app in dev dashboard, add Railway env vars, save install URL
// Step 3 — Invite admin (name + email → POST /api/admin-tasks/onboard-client/invite-admin)
// Step 4 — Done — summary + what the client needs to do next

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge, Box, Button, Callout, Card, Checkbox,
  Flex, Heading, Separator, Spinner, Text, TextField,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, ChevronRightIcon, CopyIcon,
  ExclamationTriangleIcon, InfoCircledIcon, PersonIcon,
} from '@radix-ui/react-icons';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface CreatedClient {
  clientId: string;
  name: string;
}

interface ShopifyConfig {
  shopDomain: string;
  envKey: string;
  installUrl: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <Flex align="center" gap="2" mb="6">
      {Array.from({ length: total }, (_, i) => {
        const n = (i + 1) as Step;
        const done = n < current;
        const active = n === current;
        return (
          <Flex key={n} align="center" gap="2">
            <Flex
              align="center"
              justify="center"
              width="28px"
              height="28px"
              style={{
                borderRadius: '50%',
                backgroundColor: done
                  ? 'var(--green-9)'
                  : active
                  ? 'var(--accent-9)'
                  : 'var(--gray-4)',
                color: done || active ? 'white' : 'var(--gray-9)',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {done ? <CheckCircledIcon /> : n}
            </Flex>
            {i < total - 1 && (
              <Box
                style={{
                  width: 32,
                  height: 2,
                  backgroundColor: done ? 'var(--green-9)' : 'var(--gray-4)',
                }}
              />
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button size="1" variant="ghost" color="gray" onClick={handleCopy}>
      {copied ? <CheckCircledIcon /> : <CopyIcon />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function EnvVarRow({ name }: { name: string }) {
  return (
    <Flex
      align="center"
      justify="between"
      px="3"
      py="2"
      style={{
        backgroundColor: 'var(--gray-2)',
        border: '1px solid var(--gray-5)',
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <Text style={{ fontFamily: 'monospace' }}>
        <Text weight="bold">{name}</Text>
        <Text color="gray">=…</Text>
      </Text>
      <CopyButton value={name} />
    </Flex>
  );
}

function CodeRow({ value }: { value: string }) {
  return (
    <Flex
      align="center"
      justify="between"
      px="3"
      py="2"
      style={{
        backgroundColor: 'var(--gray-2)',
        border: '1px solid var(--gray-5)',
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <Text style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Text>
      <CopyButton value={value} />
    </Flex>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function Step1Create({
  initialName = '',
  onDone,
}: {
  initialName?: string;
  onDone: (client: CreatedClient) => void;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create client.');
      onDone({ clientId: data.clientId, name: data.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="1">
        <Heading size="5">Create client</Heading>
        <Text size="2" color="gray">
          Enter the business name. Shopify and billing are configured in the next steps.
          Reward products default to Online Store — you can add more later in Edit Configuration.
        </Text>
      </Flex>

      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      <label>
        <Text as="div" size="2" weight="bold" mb="1">Business name</Text>
        <TextField.Root
          size="3"
          placeholder="e.g. Padelhaus"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmit()}
          autoFocus
        />
      </label>

      <Button size="3" onClick={handleSubmit} disabled={submitting || !name.trim()} style={{ alignSelf: 'flex-start' }}>
        {submitting && <Spinner size="1" />}
        {submitting ? 'Creating…' : 'Create client'}
        {!submitting && <ChevronRightIcon />}
      </Button>
    </Flex>
  );
}

function Step2Shopify({
  client,
  onDone,
}: {
  client: CreatedClient;
  onDone: (config: ShopifyConfig) => void;
}) {
  const [shopDomain, setShopDomain] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [partnerChecked, setPartnerChecked] = useState(false);
  const [distributionChecked, setDistributionChecked] = useState(false);
  const [railwayChecked, setRailwayChecked] = useState(false);
  const [installUrlChecked, setInstallUrlChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanKey = envKey.trim().toUpperCase().replace(/\s+/g, '_');
  const apiKeyVar = cleanKey ? `SHOPIFY_API_KEY_${cleanKey}` : 'SHOPIFY_API_KEY_<ENVKEY>';
  const apiSecretVar = cleanKey ? `SHOPIFY_API_SECRET_${cleanKey}` : 'SHOPIFY_API_SECRET_<ENVKEY>';

  const handleSave = async () => {
    if (!shopDomain.trim() || !envKey.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, shopDomain, envKey, installUrl: installUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save.');
      setSaved(true);
      setShopDomain(data.shopDomain);
      setEnvKey(data.envKey);
      if (data.installUrl) setInstallUrl(data.installUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = saved && partnerChecked && distributionChecked && railwayChecked && installUrlChecked;

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="1">
        <Heading size="5">Configure Shopify</Heading>
        <Text size="2" color="gray">
          Set the store domain and env key, then create the custom app in the Shopify
          dev dashboard and add the credentials to Railway.
        </Text>
      </Flex>

      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {/* ── 1. Store domain + envKey ── */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Badge variant="soft" radius="full">1</Badge>
            <Text weight="bold" size="2">Save to database</Text>
          </Flex>

          <Flex gap="3" direction={{ initial: 'column', sm: 'row' }}>
            <Flex direction="column" gap="1" style={{ flex: 1 }}>
              <Text as="div" size="2" weight="bold">Shop domain</Text>
              <TextField.Root
                placeholder="their-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => { setShopDomain(e.target.value); setSaved(false); }}
              />
              <Text size="1" color="gray">Protocol and trailing slash are stripped automatically.</Text>
            </Flex>
            <Flex direction="column" gap="1" style={{ flex: 1 }}>
              <Text as="div" size="2" weight="bold">Env key</Text>
              <TextField.Root
                placeholder="e.g. PADELHAUS"
                value={envKey}
                onChange={(e) => { setEnvKey(e.target.value); setSaved(false); }}
              />
              <Text size="1" color="gray">Uppercased automatically. Used to build env var names below.</Text>
            </Flex>
          </Flex>

          <Button
            size="2"
            variant={saved ? 'soft' : 'solid'}
            color={saved ? 'green' : undefined}
            onClick={handleSave}
            disabled={submitting || !shopDomain.trim() || !envKey.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {submitting && <Spinner size="1" />}
            {saved ? <><CheckCircledIcon /> Saved</> : submitting ? 'Saving…' : 'Save to DB'}
          </Button>
        </Flex>
      </Card>

      {/* ── 2. Create app in dev dashboard ── */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Badge variant="soft" radius="full">2</Badge>
            <Text weight="bold" size="2">Create custom app in Shopify dev dashboard</Text>
          </Flex>
          <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
            Go to <Text weight="bold">dev.shopify.com</Text> → Apps → Create app.
            Under <Text weight="bold">Configuration</Text>, set:
          </Text>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray" weight="bold">App Name</Text>
            <CodeRow value={`GGP – ${client.name}`} />
            <Text size="1" color="gray">This is what appears in the merchant's Shopify admin.</Text>
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray" weight="bold">App URL</Text>
            <CodeRow value={`${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://your-app.com'}/api/shopify/custom-install`} />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray" weight="bold">Allowed redirect URL</Text>
            <CodeRow value={`${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://your-app.com'}/api/shopify/callback`} />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray" weight="bold">Scopes</Text>
            <CodeRow value="read_discounts,write_discounts,read_orders" />
          </Flex>
          <Text size="2" color="gray">
            Copy the <Text weight="bold">Client ID</Text> and <Text weight="bold">Client secret</Text> from the app credentials page — you'll need them in step 4.
          </Text>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={partnerChecked}
                onCheckedChange={(v) => setPartnerChecked(!!v)}
              />
              App created, URLs and scopes set, credentials copied
            </Flex>
          </Text>
        </Flex>
      </Card>

      {/* ── 3. Set distribution method ── */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Badge variant="soft" radius="full">3</Badge>
            <Text weight="bold" size="2">Set distribution method in Partner Dashboard</Text>
          </Flex>
          <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
            In the <Text weight="bold">Partner Dashboard</Text>, open the app and go to{' '}
            <Text weight="bold">Distribution</Text>. Set the distribution method to{' '}
            <Text weight="bold">Custom distribution</Text>, then select{' '}
            <Text weight="bold">{client.name}</Text>'s store as the target merchant.
          </Text>
          <Text size="2" color="gray">
            This must be done before the merchant can install the app.
          </Text>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={distributionChecked}
                onCheckedChange={(v) => setDistributionChecked(!!v)}
              />
              Distribution set to Custom and merchant store selected
            </Flex>
          </Text>
        </Flex>
      </Card>

      {/* ── 4. Railway env vars ── */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Badge variant="soft" radius="full">4</Badge>
            <Text weight="bold" size="2">Add env vars to Railway</Text>
          </Flex>
          <Text size="2" color="gray">
            Add these two variables to the Railway deployment using the credentials from step 2.
            Paste the Client ID into the API key var and the Client secret into the secret var.
          </Text>
          <Flex direction="column" gap="2">
            <EnvVarRow name={apiKeyVar} />
            <EnvVarRow name={apiSecretVar} />
          </Flex>
          <Callout.Root color="amber" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              Redeploy or restart the Railway service after adding vars — env changes don't take effect until the process restarts.
            </Callout.Text>
          </Callout.Root>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={railwayChecked}
                onCheckedChange={(v) => setRailwayChecked(!!v)}
              />
              Env vars added to Railway and service restarted
            </Flex>
          </Text>
        </Flex>
      </Card>

      {/* ── 5. Save install URL ── */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Badge variant="soft" radius="full">5</Badge>
            <Text weight="bold" size="2">Save Shopify install URL</Text>
          </Flex>
          <Text size="2" color="gray" style={{ lineHeight: 1.6 }}>
            In the <Text weight="bold">Partner Dashboard</Text>, open the app and go to{' '}
            <Text weight="bold">Distribution</Text>. Copy the install link Shopify generates
            and paste it below. This is the URL the brand admin will use to connect their store —
            it must come from Shopify, not generated by us.
          </Text>
          <Flex direction="column" gap="1">
            <Text as="div" size="2" weight="bold">Install URL</Text>
            <TextField.Root
              placeholder="https://admin.shopify.com/store/.../oauth/install_custom_app?..."
              value={installUrl}
              onChange={(e) => { setInstallUrl(e.target.value); setInstallUrlChecked(false); }}
            />
          </Flex>
          <Button
            size="2"
            onClick={handleSave}
            disabled={submitting || !installUrl.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {submitting && <Spinner size="1" />}
            {submitting ? 'Saving…' : 'Save install URL'}
          </Button>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={installUrlChecked}
                onCheckedChange={(v) => setInstallUrlChecked(!!v)}
              />
              Install URL saved to database
            </Flex>
          </Text>
        </Flex>
      </Card>

      <Button
        size="3"
        onClick={() => onDone({ shopDomain, envKey: cleanKey, installUrl })}
        disabled={!canProceed}
        style={{ alignSelf: 'flex-start' }}
      >
        Continue to invite admin
        <ChevronRightIcon />
      </Button>

      {!canProceed && (
        <Text size="1" color="gray">
          Complete all five tasks above to continue.
        </Text>
      )}
    </Flex>
  );
}

function Step3Invite({
  client,
  onDone,
}: {
  client: CreatedClient;
  onDone: (email: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-tasks/onboard-client/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.clientId, name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite.');
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="1">
        <Heading size="5">Invite admin</Heading>
        <Text size="2" color="gray">
          Send the client an invite email. This creates their user account, links it
          to <Text weight="bold">{client.name}</Text>, and sends a secure link to set their password.
        </Text>
      </Flex>

      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {success ? (
        <Callout.Root color="green" size="2">
          <Callout.Icon><CheckCircledIcon /></Callout.Icon>
          <Callout.Text>Invite sent to {email}.</Callout.Text>
        </Callout.Root>
      ) : (
        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" weight="bold" mb="1">Admin name</Text>
            <TextField.Root
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">Admin email</Text>
            <TextField.Root
              type="email"
              placeholder="admin@clientdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !submitting && handleInvite()}
            />
          </label>
          <Button
            size="3"
            onClick={handleInvite}
            disabled={submitting || !name.trim() || !email.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {submitting && <Spinner size="1" />}
            {submitting ? 'Sending…' : 'Send invite email'}
          </Button>
        </Flex>
      )}

      <Separator size="4" />

      <Button
        size="3"
        variant={success ? 'solid' : 'outline'}
        onClick={() => onDone(email)}
        style={{ alignSelf: 'flex-start' }}
      >
        {success ? <>Continue <ChevronRightIcon /></> : 'Skip for now'}
      </Button>
    </Flex>
  );
}

function Step4Done({
  client,
  shopifyConfig,
  inviteEmail,
}: {
  client: CreatedClient;
  shopifyConfig: ShopifyConfig;
  inviteEmail: string;
}) {
  const router = useRouter();

  const youDid = [
    { label: 'Client record created', detail: `ID: ${client.clientId}` },
    { label: 'Shop domain set', detail: shopifyConfig.shopDomain },
    { label: 'Env key set', detail: shopifyConfig.envKey },
    { label: 'Custom app created', detail: `GGP – ${client.name}` },
    { label: 'Distribution set', detail: 'Custom distribution — merchant store selected' },
    { label: 'Railway env vars added', detail: `SHOPIFY_API_KEY_${shopifyConfig.envKey} + SECRET` },
    { label: 'Install URL saved', detail: shopifyConfig.installUrl ? '✓' : '—' },
    ...(inviteEmail ? [{ label: 'Admin invited', detail: inviteEmail }] : []),
  ];

  const clientDoes = [
    'Accepts invite email and sets password',
    'Logs in and goes to Connect Shopify',
    'Approves permissions on Shopify',
    'Adds payment method on the billing page',
  ];

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="1">
        <Flex align="center" gap="3">
          <CheckCircledIcon width={32} height={32} color="var(--green-9)" />
          <Heading size="6">{client.name} is set up</Heading>
        </Flex>
        <Text size="2" color="gray">
          Everything on your end is done. Here's the full picture.
        </Text>
      </Flex>

      <Card size="2">
        <Flex direction="column" gap="3">
          <Text weight="bold" size="2">✅ You completed</Text>
          <Flex direction="column" gap="2">
            {youDid.map((item) => (
              <Flex key={item.label} justify="between" align="center">
                <Flex align="center" gap="2">
                  <CheckCircledIcon color="var(--green-9)" />
                  <Text size="2">{item.label}</Text>
                </Flex>
                <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>{item.detail}</Text>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <PersonIcon />
            <Text weight="bold" size="2">Client still needs to</Text>
          </Flex>
          <Flex direction="column" gap="2">
            {clientDoes.map((item, i) => (
              <Flex key={i} align="center" gap="2">
                <Box
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '2px solid var(--gray-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--gray-9)',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                <Text size="2">{item}</Text>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Card>

      <Callout.Root color="blue" size="1">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          Once the client connects Shopify and adds a payment method, their status badges
          on the clients page will turn green automatically.
        </Callout.Text>
      </Callout.Root>

      <Flex gap="3">
        <Button size="3" onClick={() => router.push('/admin/gg/config')}>
          Back to clients
        </Button>
        <Button
          size="3"
          variant="outline"
          onClick={() => router.push('/admin/gg/onboard')}
        >
          Onboard another client
        </Button>
      </Flex>
    </Flex>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [client, setClient] = useState<CreatedClient | null>(null);
  const [shopifyConfig, setShopifyConfig] = useState<ShopifyConfig | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  // Pre-fill from brand application if redirected from brand-applications page
  const prefilledName = searchParams.get('name') ?? '';

  return (
    <Flex direction="column" style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <Flex
        justify="between"
        align="center"
        height="64px"
        px="6"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--gray-4)' }}
      >
        <Flex align="center" gap="4">
          <Image src={darkGgLogo} alt="Logo" height={32} width={60} style={{ objectFit: 'contain' }} />
          <Separator orientation="vertical" style={{ height: 20 }} />
          <Text weight="bold" size="3">Onboard New Client</Text>
        </Flex>
        <Button variant="soft" color="gray" onClick={() => router.push('/admin/gg/config')}>
          ← Back to clients
        </Button>
      </Flex>

      <Box p="6">
        <Flex direction="column" gap="0" style={{ maxWidth: 620, margin: '0 auto' }}>
          <StepIndicator current={step} total={4} />

          <Card size="4">
            {step === 1 && (
              <Step1Create
                initialName={prefilledName}
                onDone={(c) => { setClient(c); setStep(2); }}
              />
            )}
            {step === 2 && client && (
              <Step2Shopify
                client={client}
                onDone={(config) => { setShopifyConfig(config); setStep(3); }}
              />
            )}
            {step === 3 && client && (
              <Step3Invite
                client={client}
                onDone={(email) => { setInviteEmail(email); setStep(4); }}
              />
            )}
            {step === 4 && client && shopifyConfig && (
              <Step4Done
                client={client}
                shopifyConfig={shopifyConfig}
                inviteEmail={inviteEmail}
              />
            )}
          </Card>
        </Flex>
      </Box>
    </Flex>
  );
}