'use client'

// app/(ADMIN)/admin/gg/config/page.tsx
//
// Changes from original:
//   - Custom mode: "Create New Client" navigates to /admin/gg/onboard
//   - Public mode: create dialog stripped to name only
//   - Edit dialog: envKey field added to Shopify section; accessToken/secret hidden in custom mode
//   - Status badges: label/color accounts for custom mode
//   - Attention flag labels: mode-aware
//   - Reservation software dropdown removed

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  Avatar, Badge, Box, Button, Callout, Card, Checkbox, Dialog,
  DropdownMenu, Flex, Heading, Select, Spinner, Text, TextField, Tooltip,
} from "@radix-ui/themes";
import {
  InfoCircledIcon, DotsHorizontalIcon, GearIcon, MagicWandIcon,
  ExclamationTriangleIcon, CheckCircledIcon, EnvelopeClosedIcon,
} from "@radix-ui/react-icons";
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { AdminPermissionType, IClient, PodplayData, ShopifyData } from "@/app/types/databaseTypes";
import { AdminSidebar } from "../../components/AdminSidebar";
import { REWARD_PRODUCT_NAMES, RewardProductName } from "@/app/types/rewardTypes";
import { RewardCardPreview } from "../components/ReviewCardPreview";
import ManageWebhooks from "../components/ManageWebhooks";

const CUSTOM_MODE = process.env.NEXT_PUBLIC_SHOPIFY_APP_MODE === 'custom';

const PRODUCT_DISPLAY_NAMES: Record<RewardProductName, string> = {
  "open play": "Open Play",
  "reservations": "Reservations",
  "guest reservations": "Guest Reservations",
  "classes and clinics": "Classes and Clinics",
  "pro shop": "Pro Shop",
  "online store": "Online Store",
  "in store": "In Store",
  "custom": "Custom",
};

type FormState = {
  _id?: string;
  name: string;
  logo: string;
  admin_logo: string;
  icon: string;
  latitude: string;
  longitude: string;
  products: Record<RewardProductName, boolean>;
  retailSoftware?: 'shopify' | 'playbypoint';
  shopify: ShopifyData & { envKey?: string };
  podplay: PodplayData;
  playbypoint: {
    facilityId: number | string;
    affiliations: string;
  };
  cardBackgroundImage?: string;
  cardTextColor?: string;
};

type ClientStatus = {
  shopifyConnected: boolean;
  shopifyNoPlan: boolean;
  hasRewards: boolean;
  accountClaimed: boolean;
  attentionFlags: string[];
  needsAttention: boolean;
};

type ClientWithStatus = { _id: string; status: ClientStatus };
type ExtendedClient = Omit<IClient, 'needsRetroactiveSweep'> & { needsRetroactiveSweep?: boolean };

const getFlagLabel = (flag: string): string => ({
  shopify_not_connected: 'Shopify not connected',
  shopify_no_plan: CUSTOM_MODE ? 'No payment method on file (Stripe)' : 'Shopify connected — no plan selected',
  stripe_no_payment_method: 'No payment method on file (Stripe)',
  account_not_claimed: 'Account not claimed',
  no_rewards_after_3_days: 'No rewards configured (3+ days)',
  shopify_webhook_missing: "Order webhook not registered — commissions won't be tracked",
  shopify_webhook_status_unknown: 'Could not verify order webhook status',
} as Record<string, string>)[flag] ?? flag;

const initialClientState: FormState = {
  name: '', logo: '', admin_logo: '', icon: '',
  products: { "open play": false, "reservations": false, "guest reservations": false, "classes and clinics": false, "pro shop": false, "online store": false, "in store": false, "custom": false },
  latitude: '', longitude: '',
  retailSoftware: undefined,
  shopify: { shopDomain: '', accessToken: '', secret: '', envKey: '' },
  playbypoint: { facilityId: '', affiliations: '' },
  podplay: { accessToken: '' },
  cardBackgroundImage: '', cardTextColor: '#ffffff',
};

export default function GgpickleballAdminClients() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [clients, setClients] = useState<ExtendedClient[]>([]);
  const [isFetchingClients, setIsFetchingClients] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<IClient | null>(null);
  const [formData, setFormData] = useState<FormState>(initialClientState);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);
  const [clientStatuses, setClientStatuses] = useState<Map<string, ClientStatus>>(new Map());
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [clientToInvite, setClientToInvite] = useState<ExtendedClient | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const EXCLUDE_FROM_ATTENTION = ['GG Pickleball Admin']; // Example: clients we know have issues but we're excluding from "Needs Attention" for now

  const attentionClients = clients.filter(c => 
    clientStatuses.get(c._id.toString())?.needsAttention &&
    !EXCLUDE_FROM_ATTENTION.includes(c.name)
  );

  const fetchClients = async () => {
    setIsFetchingClients(true);
    setFetchError(null);
    try {
      const r = await fetch('/api/client');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to fetch clients");
      setClients(d.clients);
      const sr = await fetch('/api/admin/client-status');
      if (sr.ok) {
        const sd = await sr.json();
        const m = new Map<string, ClientStatus>();
        (sd.clients as ClientWithStatus[]).forEach(c => m.set(c._id, c.status));
        setClientStatuses(m);
      }
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsFetchingClients(false);
    }
  };

  const handleToggleSweepFlag = async (client: ExtendedClient, v: boolean) => {
    try {
      const r = await fetch('/api/client/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client._id,
          needsRetroactiveSweep: v
        })
      });
      if (!r.ok) throw new Error();
      setClients(prev => prev.map(c =>
        c._id === client._id
          ? { ...c, needsRetroactiveSweep: v } as ExtendedClient
          : c
        ));
    } catch { alert("Failed to update client status"); }
  };

  useEffect(() => { fetchClients(); }, []);
  useEffect(() => {if (!auth0IsLoading && !user) router.push('/auth/login?returnTo=/admin/gg/config'); }, [auth0IsLoading, user, router]);
  useEffect(() => { if (user) setAdminPermission(user.superAdmin ? 'admin' : 'associate'); }, [user]);

  const handleOpenCreateDialog = () => {
    setSelectedClientForEdit(null);
    setFormData(initialClientState);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditDialog = (client: IClient) => {
    setSelectedClientForEdit(client);
    const products: Record<RewardProductName, boolean> = { ...initialClientState.products };
    client.rewardProducts?.forEach(p => { if (p in products) products[p as RewardProductName] = true; });
    setFormData({
      _id: client._id.toString(), name: client.name, logo: client.logo || '', admin_logo: client.admin_logo || '',
      icon: client.icon || '', latitude: client.latitude?.toString() || '', longitude: client.longitude?.toString() || '',
      products, retailSoftware: client.retailSoftware,
      shopify: { ...(client.shopify || initialClientState.shopify), envKey: (client.shopify as any)?.envKey || '' },
      podplay: client.podplay || initialClientState.podplay,
      playbypoint: { facilityId: client.playbypoint?.facilityId || '', affiliations: client.playbypoint?.affiliations?.join(', ') || '' },
      cardBackgroundImage: client.cardBackgroundImage || '', cardTextColor: client.cardTextColor || '#ffffff',
    });
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const handleOpenInviteDialog = (client: ExtendedClient) => { setClientToInvite(client); setInviteName(''); setInviteEmail(''); setInviteMessage(null); setIsInviteDialogOpen(true); };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToInvite || !inviteEmail) return;
    setIsInviting(true); setInviteMessage(null);
    try {
      const r = await fetch('/api/admin-tasks/onboard-client/invite-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: clientToInvite._id, name: inviteName, email: inviteEmail }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setInviteMessage({ type: 'success', text: d.message || `Invite sent to ${inviteEmail}` });
      setInviteEmail('');
    } catch (e: any) { setInviteMessage({ type: 'error', text: e.message }); }
    finally { setIsInviting(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.') as [keyof FormState, string];
      setFormData(prev => ({ ...prev, [parent]: { ...(prev[parent] as object), [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleShopDomainBlur = () => {
    const d = formData.shopify.shopDomain;
    if (!d?.trim()) return;
    const clean = d.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (clean !== d) setFormData(prev => ({ ...prev, shopify: { ...prev.shopify, shopDomain: clean } }));
  };

  const handleSelectChange = (value: string, name: 'retailSoftware') => {
    setFormData(prev => ({ ...prev, [name]: value === 'none' ? undefined : value as any }));
  };

  const handleCheckboxChange = (checked: boolean, name: RewardProductName) => {
    setFormData(prev => ({ ...prev, products: { ...prev.products, [name]: checked } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setSubmitError(null);
    try {
      const { _id: _, products, playbypoint: pbp, latitude: latStr, longitude: lngStr, ...base } = formData;
      const rewardProductsPayload = REWARD_PRODUCT_NAMES.filter(n => products[n]);
      const lat = parseFloat(latStr), lng = parseFloat(lngStr);
      const payload: any = {
        ...base,
        latitude: !isNaN(lat) ? lat : undefined, longitude: !isNaN(lng) ? lng : undefined,
        rewardProducts: rewardProductsPayload,
        playbypoint: base.retailSoftware === 'playbypoint'
          ? { facilityId: pbp.facilityId ? Number(pbp.facilityId) : undefined, affiliations: pbp.affiliations.split(',').map((s: string) => s.trim()).filter(Boolean) }
          : undefined,
      };
      if (payload.retailSoftware !== 'shopify') delete payload.shopify;
      if (payload.reservationSoftware !== 'podplay') delete payload.podplay;
      const isEditing = !!selectedClientForEdit;
      const r = await fetch(isEditing ? '/api/client/update' : '/api/client', {
        method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing ? { clientId: selectedClientForEdit?._id.toString(), ...payload } : payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      await fetchClients(); setIsFormOpen(false);
    } catch (e: unknown) { setSubmitError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setIsSubmitting(false); }
  };

  const userName = user?.name;
  if (isMobile === null) return null;

  if (user && !user.superAdmin) {
    return (
      <Flex direction="column" height="100vh">
        <Flex justify="between" align="center" px={{ initial: '3', md: '9' }} py="4">
          <Flex direction="column" position="relative" maxWidth="80px"><Image src={darkGgLogo} alt="GG Pickleball" priority height={540} width={960} /></Flex>
          {!auth0IsLoading && <Text size="3" weight="bold">{userName ? (auth0User ? `Welcome ${String(userName).split('@')[0]}` : `${String(userName).split('@')[0]} (guest)`) : ''}</Text>}
        </Flex>
        <Flex direction="column" align="center" justify="center" height="300px"><Text>You do not have access to this page</Text></Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      <Flex justify="between" align="center" px={{ initial: '3', md: '9' }} py="4">
        <Flex direction="column" position="relative" maxWidth="80px"><Image src={darkGgLogo} alt="GG Pickleball" priority height={540} width={960} /></Flex>
        {!auth0IsLoading && <Text size="3" weight="bold">{userName ? (auth0User ? `Welcome ${String(userName).split('@')[0]}` : `${String(userName).split('@')[0]} (guest)`) : ''}</Text>}
      </Flex>

      <Flex direction="column" width="100vw">
        <Flex direction="row" height="100%">
          {!isMobile && <AdminSidebar adminPermission={adminPermission} />}
          <Flex direction="column" py="4" px={{ initial: '2', md: '6' }} width="100%" overflow="auto">
            <Flex justify="between" align="center" mb="6">
              <Heading>Manage Clients</Heading>
              {CUSTOM_MODE
                ? <Button onClick={() => router.push('/admin/gg/onboard')}>+ Onboard New Client</Button>
                : <Button onClick={handleOpenCreateDialog}>Create New Client</Button>
              }
            </Flex>

            {isFetchingClients ? (
              <Flex justify="center" align="center" mt="9"><Spinner size="3" /></Flex>
            ) : fetchError ? (
              <Callout.Root color="red"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{fetchError}</Callout.Text></Callout.Root>
            ) : (
              <>
                {attentionClients.length > 0 && (
                  <Box mb="5">
                    <Flex align="center" gap="2" mb="3">
                      <ExclamationTriangleIcon color="var(--amber-9)" />
                      <Text weight="bold" size="3">Needs attention ({attentionClients.length})</Text>
                    </Flex>
                    <Flex direction="column" gap="2">
                      {attentionClients.map(client => {
                        const status = clientStatuses.get(client._id.toString());
                        if (!status) return null;
                        return (
                          <Card key={client._id.toString()} style={{ borderLeft: '3px solid var(--amber-9)' }}>
                            <Flex justify="between" align="start">
                              <Box>
                                <Text weight="bold" size="2">{client.name}</Text>
                                <Flex direction="column" gap="1" mt="1">
                                  {status.attentionFlags.map(flag => (
                                    <Flex key={flag} align="center" gap="2">
                                      <ExclamationTriangleIcon color="var(--amber-9)" width={12} height={12} />
                                      <Text size="1" color="amber">{getFlagLabel(flag)}</Text>
                                    </Flex>
                                  ))}
                                </Flex>
                              </Box>
                              <Button size="1" variant="soft" color="gray" onClick={() => handleOpenEditDialog(client as IClient)}>Edit</Button>
                            </Flex>
                          </Card>
                        );
                      })}
                    </Flex>
                  </Box>
                )}

                <Flex direction="column" gap="3">
                  {clients.length > 0 ? clients
                    .filter(c => !EXCLUDE_FROM_ATTENTION.includes(c.name))
                    .map(client => {
                    const status = clientStatuses.get(client._id.toString());
                    return (
                      <Card key={client._id.toString()}>
                        <Flex gap="4" align="start">
                          <Avatar radius="full" size="3" src={client.icon || undefined} fallback={client.name.charAt(0).toUpperCase()} />
                          <Box flexGrow="1">
                            <Flex align="center" gap="2" mb="1">
                              <Text as="div" weight="bold">{client.name}</Text>
                              {client.needsRetroactiveSweep && <Badge color="amber" variant="solid" size="1"><ExclamationTriangleIcon /> Sweep Needed</Badge>}
                            </Flex>
                            <Text as="div" size="2" color="gray" mb="2">ID: {client._id.toString()}</Text>
                            {status && (
                              <Flex gap="2" wrap="wrap">
                                <Badge color={status.accountClaimed ? 'green' : 'gray'} variant="soft" size="1">
                                  {status.accountClaimed ? '✓' : '○'} Account
                                </Badge>
                                <Badge
                                  color={status.shopifyConnected ? 'green' : status.shopifyNoPlan ? 'amber' : 'gray'}
                                  variant="soft" size="1"
                                >
                                  {status.shopifyConnected ? '✓' : status.shopifyNoPlan ? '!' : '○'}{' '}
                                  {CUSTOM_MODE
                                    ? (status.shopifyConnected ? 'Connected + Billing' : status.shopifyNoPlan ? 'Connected, no payment' : 'Not connected')
                                    : (status.shopifyConnected ? 'Shopify' : status.shopifyNoPlan ? 'No plan' : 'Shopify')}
                                </Badge>
                                <Badge color={status.hasRewards ? 'green' : 'gray'} variant="soft" size="1">
                                  {status.hasRewards ? '✓' : '○'} Rewards
                                </Badge>
                              </Flex>
                            )}
                          </Box>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger>
                              <Button variant="soft" color="gray"><DotsHorizontalIcon /> Actions</Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                              <DropdownMenu.Item onClick={() => handleOpenInviteDialog(client)}><EnvelopeClosedIcon /> Invite Admin</DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item onClick={() => handleOpenEditDialog(client as IClient)}><GearIcon /> Edit Configuration</DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item color="blue" onClick={() => router.push(`/admin/client/${client._id.toString()}/retroactive`)}><MagicWandIcon /> Retroactive Sweep</DropdownMenu.Item>
                              {client.needsRetroactiveSweep && <DropdownMenu.Item color="gray" onClick={() => handleToggleSweepFlag(client, false)}><CheckCircledIcon /> Mark as Complete</DropdownMenu.Item>}
                              {!client.needsRetroactiveSweep && <DropdownMenu.Item onClick={() => handleToggleSweepFlag(client, true)}>Flag for Sweep</DropdownMenu.Item>}
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>
                        </Flex>
                      </Card>
                    );
                  }) : <Text color="gray">No clients found.</Text>}
                </Flex>
                <ManageWebhooks />
              </>
            )}
          </Flex>
        </Flex>
      </Flex>

      {/* Invite Admin Dialog */}
      <Dialog.Root open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Invite Client Admin</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Send an onboarding email to an administrator for <strong>{clientToInvite?.name}</strong>.
            They'll receive a secure link to set their password and access their dashboard.
          </Dialog.Description>
          {inviteMessage && (
            <Callout.Root color={inviteMessage.type === 'success' ? 'green' : 'red'} mb="4">
              <Callout.Icon>{inviteMessage.type === 'success' ? <CheckCircledIcon /> : <ExclamationTriangleIcon />}</Callout.Icon>
              <Callout.Text>{inviteMessage.text}</Callout.Text>
            </Callout.Root>
          )}
          <form onSubmit={handleInviteSubmit}>
            <Flex direction="column" gap="4">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Admin Name</Text>
                <TextField.Root type="text" placeholder="e.g. Jane Doe" value={inviteName} onChange={e => setInviteName(e.target.value)} required />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Admin Email</Text>
                <TextField.Root type="email" placeholder="admin@clientdomain.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              </label>
              <Flex gap="3" mt="2" justify="end">
                <Dialog.Close><Button variant="soft" color="gray" type="button">Cancel</Button></Dialog.Close>
                <Button type="submit" loading={isInviting}>Send Invite Email</Button>
              </Flex>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* Create/Edit Client Dialog */}
      <Dialog.Root open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Dialog.Content maxWidth="550px">
          <Dialog.Title>{selectedClientForEdit ? 'Edit Client' : 'Create New Client'}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {selectedClientForEdit ? `Editing ${selectedClientForEdit.name}.` : 'Enter a name to create the client record.'}
          </Dialog.Description>
          {submitError && <Callout.Root color="red" mb="4"><Callout.Text>{submitError}</Callout.Text></Callout.Root>}
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="5">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Name *</Text>
                <TextField.Root name="name" value={formData.name || ''} onChange={handleInputChange} required />
              </label>

              {selectedClientForEdit && (
                <>
                  <label><Text as="div" size="2" mb="1" weight="bold">Logo URL (players)</Text><TextField.Root name="logo" value={formData.logo || ''} onChange={handleInputChange} /></label>
                  <label><Text as="div" size="2" mb="1" weight="bold">Admin Logo URL</Text><TextField.Root name="admin_logo" value={formData.admin_logo || ''} onChange={handleInputChange} /></label>
                  <label><Text as="div" size="2" mb="1" weight="bold">Icon URL</Text><TextField.Root name="icon" value={formData.icon || ''} onChange={handleInputChange} /></label>

                  <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                    <Heading size="3" mb="3">Reward Card Design</Heading>
                    <Flex gap="5" direction={{ initial: 'column', sm: 'row' }}>
                      <Flex direction="column" gap="3" flexGrow="1">
                        <label><Text as="div" size="2" mb="1" weight="bold">Background Image URL</Text><TextField.Root name="cardBackgroundImage" value={formData.cardBackgroundImage || ''} onChange={handleInputChange} placeholder="https://..." /></label>
                        <label>
                          <Text as="div" size="2" weight="bold" mb="1">Text Color</Text>
                          <Select.Root value={formData.cardTextColor || '#ffffff'} onValueChange={val => setFormData(prev => ({ ...prev, cardTextColor: val }))}>
                            <Select.Trigger />
                            <Select.Content>
                              <Select.Item value="#ffffff">White</Select.Item>
                              <Select.Item value="#000000">Black</Select.Item>
                            </Select.Content>
                          </Select.Root>
                        </label>
                      </Flex>
                      <Flex direction="column" align="center" gap="2">
                        <Text size="1" weight="bold" color="gray">PREVIEW</Text>
                        <RewardCardPreview backgroundImage={formData.cardBackgroundImage} textColor={formData.cardTextColor} clientName={formData.name || "Client Name"} />
                      </Flex>
                    </Flex>
                  </Box>

                  <Box>
                    <Text as="div" size="2" mb="2" weight="bold">Reward Products</Text>
                    <Flex direction="column" gap="2">
                      {REWARD_PRODUCT_NAMES.map(p => (
                        <Text as="label" size="2" key={p}>
                          <Flex gap="2" align="center">
                            <Checkbox checked={formData.products[p]} onCheckedChange={c => handleCheckboxChange(c as boolean, p)} />
                            {PRODUCT_DISPLAY_NAMES[p]}
                          </Flex>
                        </Text>
                      ))}
                    </Flex>
                  </Box>

                  <label>
                    <Text as="div" size="2" mb="1" weight="bold">Retail Software</Text>
                    <Select.Root value={formData.retailSoftware || 'none'} onValueChange={v => handleSelectChange(v, 'retailSoftware')}>
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="none">None</Select.Item>
                        <Select.Item value="shopify">Shopify</Select.Item>
                        <Select.Item value="playbypoint">PlayByPoint</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </label>

                  {formData.retailSoftware === 'shopify' && (
                    <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                      <Heading size="3" mb="2">Shopify Config</Heading>
                      <Flex direction="column" gap="2">
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Shop Domain</Text>
                          <TextField.Root name="shopify.shopDomain" value={formData.shopify.shopDomain || ''} onChange={handleInputChange} onBlur={handleShopDomainBlur} placeholder="example.myshopify.com" />
                        </label>
                        {CUSTOM_MODE && (
                          <label>
                            <Text as="div" size="2" mb="1" weight="bold">Env Key</Text>
                            <TextField.Root name="shopify.envKey" value={(formData.shopify as any).envKey || ''} onChange={handleInputChange} placeholder="e.g. PADELHAUS" />
                            <Text size="1" color="gray" mt="1">Resolves to SHOPIFY_API_KEY_{'<ENVKEY>'} in Railway.</Text>
                          </label>
                        )}
                        {!CUSTOM_MODE && (
                          <>
                            <label><Text as="div" size="2" mb="1" weight="bold">Access Token</Text><TextField.Root name="shopify.accessToken" value={formData.shopify.accessToken || ''} onChange={handleInputChange} /></label>
                            <label><Text as="div" size="2" mb="1" weight="bold">Secret</Text><TextField.Root name="shopify.secret" value={formData.shopify.secret || ''} onChange={handleInputChange} /></label>
                          </>
                        )}
                      </Flex>
                    </Box>
                  )}

                  {formData.retailSoftware === 'playbypoint' && (
                    <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                      <Heading size="3" mb="2">PlayByPoint Config</Heading>
                      <Flex direction="column" gap="2">
                        <label><Text as="div" size="2" mb="1" weight="bold">Facility ID</Text><TextField.Root type="number" name="playbypoint.facilityId" value={formData.playbypoint.facilityId || ''} onChange={handleInputChange} /></label>
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Affiliations</Text>
                          <Tooltip content="Comma-separated.">
                            <TextField.Root name="playbypoint.affiliations" value={formData.playbypoint.affiliations || ''} onChange={handleInputChange} placeholder="Affiliate A, Affiliate B" />
                          </Tooltip>
                        </label>
                      </Flex>
                    </Box>
                  )}
                </>
              )}
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close><Button variant="soft" color="gray" type="button">Cancel</Button></Dialog.Close>
              <Button type="submit" loading={isSubmitting}>{selectedClientForEdit ? 'Save Changes' : 'Create Client'}</Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}