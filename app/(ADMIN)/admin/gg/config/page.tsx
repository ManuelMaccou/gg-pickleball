'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { 
  Avatar, 
  Badge, 
  Box, 
  Button, 
  Callout, 
  Card, 
  Checkbox, 
  Dialog, 
  DropdownMenu, 
  Flex, 
  Heading, 
  Select, 
  Spinner, 
  Text, 
  TextField, 
  Tooltip 
} from "@radix-ui/themes";
import { 
  InfoCircledIcon, 
  DotsHorizontalIcon, 
  GearIcon,          
  MagicWandIcon,      
  ExclamationTriangleIcon,
  CheckCircledIcon,
  EnvelopeClosedIcon // <--- Added Icon for Invites
} from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { AdminPermissionType, IClient, PodplayData, ShopifyData } from "@/app/types/databaseTypes";
import { AdminSidebar } from "../../components/AdminSidebar";
import { REWARD_PRODUCT_NAMES, RewardProductName } from "@/app/types/rewardTypes";
import { RewardCardPreview } from "../components/ReviewCardPreview";
import ManageWebhooks from "../components/ManageWebhooks";

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
  reservationSoftware?: 'playbypoint' | 'podplay' | 'courtreserve';
  shopify: ShopifyData;
  podplay: PodplayData;
  playbypoint: {
    facilityId: number | string;
    affiliations: string;
  };
  cardBackgroundImage?: string;
  cardTextColor?: string;
};

const initialClientState: FormState = {
  name: '',
  logo: '',
  admin_logo: '',
  icon: '',
  products: {
    "open play": false,
    "reservations": false,
    "guest reservations": false,
    "classes and clinics": false,
    "pro shop": false,
    "online store": false,
    "in store": false,
    "custom": false
  },
  latitude: '',
  longitude: '',
  retailSoftware: undefined,
  reservationSoftware: undefined,
  shopify: { shopDomain: '', accessToken: '', secret: '' },
  playbypoint: { facilityId: '', affiliations: '' },
  podplay: { accessToken: '' },
  cardBackgroundImage: '',
  cardTextColor: '#ffffff',
};

type ExtendedClient = Omit<IClient, 'needsRetroactiveSweep'> & {
  needsRetroactiveSweep?: boolean;
};

export default function GgpickleballAdminClients() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [clients, setClients] = useState<ExtendedClient[]>([]);
  const [isFetchingClients, setIsFetchingClients] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<IClient | null>(null);
  const [formData, setFormData] = useState<FormState>(initialClientState);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);

  // --- NEW: Invite Admin State ---
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [clientToInvite, setClientToInvite] = useState<ExtendedClient | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const fetchClients = async () => {
    setIsFetchingClients(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/client');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch clients");
      setClients(data.clients);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setFetchError(error.message);
      } else {
        setFetchError("An unknown error occurred while fetching clients.");
      }
    } finally {
      setIsFetchingClients(false);
    }
  };

  const handleToggleSweepFlag = async (client: ExtendedClient, newValue: boolean) => {
    try {
      const response = await fetch('/api/client/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientId: client._id, 
          needsRetroactiveSweep: newValue 
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      setClients(prev => prev.map(c => 
        c._id === client._id 
          ? { ...c, needsRetroactiveSweep: newValue } as ExtendedClient 
          : c
      ));

    } catch (error) {
      console.error(error);
      alert("Failed to update client status");
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin/gg/config`);
    }
  }, [auth0IsLoading, user, router]);

  const handleOpenCreateDialog = () => {
    setSelectedClientForEdit(null);
    setFormData(initialClientState);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditDialog = (client: IClient) => {
    setSelectedClientForEdit(client);

    const productsForForm: Record<RewardProductName, boolean> = { ...initialClientState.products };
    client.rewardProducts?.forEach(productName => {
      if (productName in productsForForm) {
        productsForForm[productName as RewardProductName] = true;
      }
    });

    const formDataForEdit: FormState = {
      _id: client._id.toString(),
      name: client.name,
      logo: client.logo || '',
      admin_logo: client.admin_logo || '',
      icon: client.icon || '',
      latitude: client.latitude?.toString() || '',
      longitude: client.longitude?.toString() || '',
      products: productsForForm,
      retailSoftware: client.retailSoftware,
      reservationSoftware: client.reservationSoftware,
      shopify: client.shopify || initialClientState.shopify,
      podplay: client.podplay || initialClientState.podplay,
      playbypoint: {
        facilityId: client.playbypoint?.facilityId || '',
        affiliations: client.playbypoint?.affiliations?.join(', ') || ''
      },
      cardBackgroundImage: client.cardBackgroundImage || '',
      cardTextColor: client.cardTextColor || '#ffffff',
    };

    setFormData(formDataForEdit);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  // --- NEW: Invite Admin Handlers ---
  const handleOpenInviteDialog = (client: ExtendedClient) => {
    setClientToInvite(client);
    setInviteName('');
    setInviteEmail('');
    setInviteMessage(null);
    setIsInviteDialogOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToInvite || !inviteEmail) return;

    setIsInviting(true);
    setInviteMessage(null);

    try {
      const response = await fetch('/api/admin-tasks/onboard-client/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientId: clientToInvite._id,
          name: inviteName,
          email: inviteEmail 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to send invite');

      setInviteMessage({ type: 'success', text: data.message || `Invite sent successfully to ${inviteEmail}` });
      setInviteEmail(''); // clear form on success

    } catch (error: any) {
      setInviteMessage({ type: 'error', text: error.message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.') as [keyof FormState, string];
      setFormData(prev => ({
        ...prev,
        [parent]: { ...(prev[parent] as object), [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleShopDomainBlur = () => {
    const currentDomain = formData.shopify.shopDomain;
    
    if (!currentDomain || currentDomain.trim() === '') return;

    const cleanDomain = currentDomain.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    if (cleanDomain !== currentDomain) {
      setFormData(prev => ({
        ...prev,
        shopify: {
          ...prev.shopify,
          shopDomain: cleanDomain
        }
      }));
    }
  };

  const handleSelectChange = (value: string, name: 'retailSoftware' | 'reservationSoftware') => {
    setFormData(prev => ({ ...prev, [name]: value === 'none' ? undefined : value as FormState[typeof name] }));
  };

  const handleCheckboxChange = (checked: boolean, name: RewardProductName) => {
    setFormData(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [name]: checked,
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const {
        _id: _, 
        products,
        playbypoint: formPlayByPointData,
        latitude: latString, 
        longitude: lngString,
        ...basePayload 
      } = formData;

      const rewardProductsPayload: string[] = [];
      for (const name of REWARD_PRODUCT_NAMES) {
        if (products[name]) {
          rewardProductsPayload.push(name);
        }
      }

      const lat = parseFloat(latString);
      const lng = parseFloat(lngString);
      const latitude = !isNaN(lat) ? lat : undefined;
      const longitude = !isNaN(lng) ? lng : undefined;

      let playbypointPayload;
      if (basePayload.reservationSoftware === 'playbypoint') {
        playbypointPayload = {
          facilityId: formPlayByPointData.facilityId ? Number(formPlayByPointData.facilityId) : undefined,
          affiliations: formPlayByPointData.affiliations.split(',').map(s => s.trim()).filter(Boolean),
        };
      }

      const payload: Partial<Omit<IClient, keyof Document>> = {
        ...basePayload,
        latitude,
        longitude,
        rewardProducts: rewardProductsPayload,
        playbypoint: playbypointPayload,
      };
        
      if (payload.retailSoftware !== 'shopify') delete payload.shopify;
      if (payload.reservationSoftware !== 'podplay') delete payload.podplay;
      
      const isEditing = !!selectedClientForEdit;
      const url = isEditing ? '/api/client/update' : '/api/client';
      const method = isEditing ? 'PATCH' : 'POST';

      const body = isEditing 
        ? { clientId: selectedClientForEdit?._id.toString(), ...payload } 
        : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} client`);

      await fetchClients();
      setIsFormOpen(false);

    } catch (error: unknown) {
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("An unknown error occurred while submitting the form.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.superAdmin) {
      setAdminPermission('admin')
    } else {
      setAdminPermission('associate')
    }
  }, [user])

  const userName = user?.name;
  if (isMobile === null) return null;

  if (user && !user.superAdmin) {
      return (
        <Flex direction="column" height="100vh">
           <Flex
            justify="between"
            align="center"
            direction="row"
            px={{ initial: '3', md: '9' }}
            py="4"
          >
            <Flex direction="column" position="relative" maxWidth="80px">
              <Image
                src={darkGgLogo}
                alt="GG Pickleball dark logo"
                priority
                height={540}
                width={960}
              />
            </Flex>
            {!auth0IsLoading && (
              <Flex direction="row" justify="center" align="center">
                <Text size="3" weight="bold" align="right">
                  {userName
                    ? auth0User
                      ? `Welcome ${
                          String(userName).includes('@') ? String(userName).split('@')[0] : userName
                        }`
                      : `${
                          String(userName).includes('@') ? String(userName).split('@')[0] : userName
                        } (guest)`
                    : ''}
                </Text>
              </Flex>
            )}
          </Flex>
          <Flex direction="column" align="center" justify="center" height="300px">
            <Text>You do not have access to this page</Text>
          </Flex>
        </Flex>
      );
  }

  return (
    <Flex direction="column" minHeight="100vh">
      {/* Header */}
      <Flex
        justify="between"
        align="center"
        direction="row"
        px={{ initial: '3', md: '9' }}
        py="4"
      >
        <Flex direction="column" position="relative" maxWidth="80px">
          <Image
            src={darkGgLogo}
            alt="GG Pickleball dark logo"
            priority
            height={540}
            width={960}
          />
        </Flex>
        {!auth0IsLoading && (
          <Flex direction="row" justify="center" align="center">
            <Text size="3" weight="bold" align="right">
              {userName
                ? auth0User
                  ? `Welcome ${
                      String(userName).includes('@') ? String(userName).split('@')[0] : userName
                    }`
                  : `${
                      String(userName).includes('@') ? String(userName).split('@')[0] : userName
                    } (guest)`
                : ''}
            </Text>
          </Flex>
        )}
      </Flex>

      <Flex direction={'column'} width={'100vw'}>
        <Flex direction={'row'} height={'100%'}>
          {!isMobile && <AdminSidebar adminPermission={adminPermission} />}

            {/* Main Content Area */}
            <Flex direction={'column'} py={'4'} px={{initial: '2', md: '6'}} width={'100%'} overflow={'auto'}>
              <Flex justify="between" align="center" mb="6">
                <Heading>Manage Clients</Heading>
                <Button onClick={handleOpenCreateDialog}>Create New Client</Button>
              </Flex>

              {isFetchingClients ? (
                <Flex justify={'center'} align={'center'} mt={'9'}><Spinner size={'3'} /></Flex>
              ) : fetchError ? (
                <Callout.Root color="red"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{fetchError}</Callout.Text></Callout.Root>
              ) : (
                <>
                <Flex direction="column" gap="3">
                  {clients.length > 0 ? clients.map(client => (
                    <Card key={client._id.toString()}>
                      <Flex gap="4" align="center">
                        <Avatar radius="full" size="3" src={client.icon || undefined} fallback={client.name.charAt(0).toUpperCase()}/>
                        <Box flexGrow={'1'}>
                          <Text as="div" weight="bold">{client.name}</Text>
                          {client.needsRetroactiveSweep && (
                            <Badge color="amber" variant="solid" size="1" mb="1">
                                <ExclamationTriangleIcon /> Sweep Needed
                            </Badge>
                          )}
                          <Text as="div" size="2" color="gray">ID: {client._id.toString()}</Text>
                        </Box>
                        
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <Button variant="soft" color="gray">
                              <DotsHorizontalIcon /> Actions
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content>
                            
                            {/* --- NEW ACTION --- */}
                            <DropdownMenu.Item onClick={() => handleOpenInviteDialog(client)}>
                              <EnvelopeClosedIcon /> Invite Admin
                            </DropdownMenu.Item>
                            
                            <DropdownMenu.Separator />

                            <DropdownMenu.Item onClick={() => handleOpenEditDialog(client as IClient)}>
                              <GearIcon /> Edit Configuration
                            </DropdownMenu.Item>
                            
                            <DropdownMenu.Separator />
                            
                            <DropdownMenu.Item 
                              color="blue"
                              onClick={() => router.push(`/admin/client/${client._id.toString()}/retroactive`)}
                            >
                              <MagicWandIcon /> Retroactive Sweep
                            </DropdownMenu.Item>

                            {client.needsRetroactiveSweep && (
                              <DropdownMenu.Item 
                                color="gray"
                                onClick={() => handleToggleSweepFlag(client, false)}
                              >
                                <CheckCircledIcon /> Mark as Complete (Ignore)
                              </DropdownMenu.Item>
                            )}

                            {!client.needsRetroactiveSweep && (
                              <DropdownMenu.Item 
                                onClick={() => handleToggleSweepFlag(client, true)}
                              >
                                Flag for Sweep
                              </DropdownMenu.Item>
                            )}

                          </DropdownMenu.Content>
                        </DropdownMenu.Root>

                      </Flex>
                    </Card>
                  )) : (
                    <Text color="gray">No clients found. Create one to get started.</Text>
                  )}
                </Flex>

                <ManageWebhooks />
                </>
              )}
            </Flex>
          </Flex>
      </Flex>

      {/* --- NEW: Invite Admin Dialog --- */}
      <Dialog.Root open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Invite Client Admin</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Send an onboarding email to an administrator for <strong>{clientToInvite?.name}</strong>. 
            They will receive a secure link to set their password and access their new dashboard.
          </Dialog.Description>

          {inviteMessage && (
            <Callout.Root color={inviteMessage.type === 'success' ? 'green' : 'red'} mb="4">
              <Callout.Icon>
                {inviteMessage.type === 'success' ? <CheckCircledIcon /> : <ExclamationTriangleIcon />}
              </Callout.Icon>
              <Callout.Text>{inviteMessage.text}</Callout.Text>
            </Callout.Root>
          )}

          <form onSubmit={handleInviteSubmit}>
            <Flex direction="column" gap="4">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Admin Name</Text>
                <TextField.Root 
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={inviteName} 
                  onChange={(e) => setInviteName(e.target.value)} 
                  required 
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Admin Email Address</Text>
                <TextField.Root 
                  type="email"
                  placeholder="admin@clientdomain.com"
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  required 
                />
              </label>

              <Flex gap="3" mt="2" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray" type="button">Cancel</Button>
                </Dialog.Close>
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
            {selectedClientForEdit ? `Editing details for ${selectedClientForEdit.name}.` : 'Fill in the details for the new client location.'}
          </Dialog.Description>
          {submitError && (<Callout.Root color="red" mb="4"><Callout.Text>{submitError}</Callout.Text></Callout.Root>)}

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="5">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Name *</Text>
                <TextField.Root name="name" value={formData.name || ''} onChange={handleInputChange} required />
              </label>
              
              {/* ... (Rest of the form remains exactly as you had it) ... */}
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Logo URL (for players)</Text>
                <TextField.Root name="logo" value={formData.logo || ''} onChange={handleInputChange} />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Admin Logo URL (for this dashboard)</Text>
                <TextField.Root name="admin_logo" value={formData.admin_logo || ''} onChange={handleInputChange} />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Icon URL</Text>
                <TextField.Root  name="icon" value={formData.icon || ''} onChange={handleInputChange} />
              </label>

              <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                <Heading size="3" mb="3">Reward Card Design</Heading>
                
                <Flex gap="5" direction={{ initial: 'column', sm: 'row' }}>
                  <Flex direction="column" gap="3" flexGrow="1">
                    <label>
                      <Text as="div" size="2" mb="1" weight="bold">Background Image URL</Text>
                      <TextField.Root 
                        name="cardBackgroundImage" 
                        value={formData.cardBackgroundImage || ''} 
                        onChange={handleInputChange} 
                        placeholder="https://..."
                      />
                    </label>
                    <label>
                      <Text as="div" size="2" mb="1" weight="bold">Text Color</Text>
                      <Select.Root 
                        name="cardTextColor" 
                        value={formData.cardTextColor || '#ffffff'} 
                        onValueChange={(val) => setFormData(prev => ({ ...prev, cardTextColor: val }))}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          <Select.Item value="#ffffff">White (Dark Backgrounds)</Select.Item>
                          <Select.Item value="#000000">Black (Light Backgrounds)</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </label>
                  </Flex>
                  <Flex direction="column" align="center" gap="2">
                    <Text size="1" weight="bold" color="gray">LIVE PREVIEW</Text>
                    <RewardCardPreview 
                      backgroundImage={formData.cardBackgroundImage}
                      textColor={formData.cardTextColor}
                      clientName={formData.name || "Client Name"}
                    />
                  </Flex>
                </Flex>
              </Box>
              
              <Box>
                <Text as="div" size="2" mb="2" weight="bold">Reward Products</Text>
                <Flex direction="column" gap="2">
                  {REWARD_PRODUCT_NAMES.map(productName => (
                    <Text as="label" size="2" key={productName}>
                      <Flex gap="2" align="center">
                        <Checkbox
                          checked={formData.products[productName]}
                          onCheckedChange={(checked) => handleCheckboxChange(checked as boolean, productName)}
                        />
                        {PRODUCT_DISPLAY_NAMES[productName]}
                      </Flex>
                    </Text>
                  ))}
                </Flex>
              </Box>

              <Flex direction={{ initial: 'column', sm: 'row' }} gap="3">
                <label style={{ flex: 1 }}>
                  <Text as="div" size="2" mb="1" weight="bold">Reservation Software</Text>
                  <Select.Root name="reservationSoftware" value={formData.reservationSoftware || 'none'} onValueChange={(value) => handleSelectChange(value, 'reservationSoftware')}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="none">None</Select.Item>
                      <Select.Item value="courtreserve">CourtReserve</Select.Item>
                      <Select.Item value="playbypoint">PlayByPoint</Select.Item>
                      <Select.Item value="podplay">PodPlay</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </label>
                <label style={{ flex: 1 }}><Text as="div" size="2" mb="1" weight="bold">Retail Software</Text>
                  <Select.Root name="retailSoftware" value={formData.retailSoftware || 'none'} onValueChange={(value) => handleSelectChange(value, 'retailSoftware')}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="none">None</Select.Item>
                      <Select.Item value="shopify">Shopify</Select.Item>
                      <Select.Item value="playbypoint">PlayByPoint</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </label>
              </Flex>
              
              {formData.retailSoftware === 'shopify' && (
                <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                  <Heading size="3" mb="2">Shopify Config</Heading>
                  <Flex direction="column" gap="2">
                    <label><Text as="div" size="2" mb="1" weight="bold">Shop Domain</Text><TextField.Root name="shopify.shopDomain" value={formData.shopify.shopDomain || ''} onChange={handleInputChange} onBlur={handleShopDomainBlur} placeholder="example.myshopify.com" /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Access Token</Text><TextField.Root name="shopify.accessToken" value={formData.shopify.accessToken || ''} onChange={handleInputChange} /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Secret</Text><TextField.Root name="shopify.secret" value={formData.shopify.secret || ''} onChange={handleInputChange} /></label>
                  </Flex>
                </Box>
              )}

              {formData.reservationSoftware === 'playbypoint' && (
                <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                  <Heading size="3" mb="2">PlayByPoint Config</Heading>
                  <Flex direction="column" gap="2">
                    <label><Text as="div" size="2" mb="1" weight="bold">Facility ID</Text><TextField.Root type="number" name="playbypoint.facilityId" value={formData.playbypoint.facilityId || ''} onChange={handleInputChange} /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Affiliations</Text><Tooltip content="Enter multiple values separated by a comma."><TextField.Root name="playbypoint.affiliations" value={formData.playbypoint.affiliations || ''} onChange={handleInputChange} placeholder="e.g., Affiliate A, Affiliate B" /></Tooltip></label>
                  </Flex>
                </Box>
              )}

               {formData.reservationSoftware === 'podplay' && (
                <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                  <Heading size="3" mb="2">PodPlay Config</Heading>
                  <Flex direction="column" gap="2">
                    <label><Text as="div" size="2" mb="1" weight="bold">Access Token</Text><TextField.Root name="podplay.accessToken" value={formData.podplay.accessToken || ''} onChange={handleInputChange} /></label>
                  </Flex>
                </Box>
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