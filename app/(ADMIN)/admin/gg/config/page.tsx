'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Avatar, Box, Button, Callout, Card, Checkbox, Dialog, Flex, Heading, Select, Spinner, Text, TextField, Tooltip } from "@radix-ui/themes";
import { InfoCircledIcon, Pencil2Icon } from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { IClient, PodplayData, ShopifyData } from "@/app/types/databaseTypes";
import GGAdminSidebar from "../components/GGAdminSidebar";


const PRODUCT_NAMES = ["open play", "reservations", "guest reservations", "classes and clinics", "pro shop", "custom"] as const;
type ProductName = typeof PRODUCT_NAMES[number];

const PRODUCT_DISPLAY_NAMES: Record<ProductName, string> = {
  "open play": "Open Play",
  "reservations": "Reservations",
  "guest reservations": "Guest Reservations",
  "classes and clinics": "Classes and Clinics",
  "pro shop": "Pro Shop",
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
  products: Record<ProductName, boolean>;
  retailSoftware?: 'shopify' | 'playbypoint';
  reservationSoftware?: 'playbypoint' | 'podplay' | 'courtreserve';
  shopify: ShopifyData;
  podplay: PodplayData;
  playbypoint: {
    facilityId: number | string;
    affiliations: string;
  };
};

// Define an initial state that strictly conforms to FormState
const initialClientState: FormState = {
  name: '',
  logo: '',
  admin_logo: '',
  icon: '',
  products: { // Initialize checkbox state
    "open play": false,
    "reservations": false,
    "guest reservations": false,
    "classes and clinics": false,
    "pro shop": false,
    "custom": false
  },
  latitude: '',
  longitude: '',
  retailSoftware: undefined,
  reservationSoftware: undefined,
  shopify: { shopDomain: '', accessToken: '', secret: '' },
  playbypoint: { facilityId: '', affiliations: '' },
  podplay: { accessToken: '' }
};

export default function GgpickleballAdminClients() {
  const { user } = useUserContext();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [clients, setClients] = useState<IClient[]>([]);
  const [isFetchingClients, setIsFetchingClients] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<IClient | null>(null);
  const [formData, setFormData] = useState<FormState>(initialClientState);

  // Fetch all clients on component mount
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

  useEffect(() => {
    fetchClients();
  }, []);

  // Auth redirection
  useEffect(() => {
    if (!auth0IsLoading && !user) {
      router.push(`/auth/login?returnTo=/admin/gg/config`);
    }
  }, [auth0IsLoading, user, router]);

  // Handler for opening the 'Create' dialog
  const handleOpenCreateDialog = () => {
    setSelectedClientForEdit(null);
    setFormData(initialClientState);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditDialog = (client: IClient) => {
    setSelectedClientForEdit(client);

    const productsForForm: Record<ProductName, boolean> = { ...initialClientState.products };
    client.rewardProducts?.forEach(productName => {
      if (productName in productsForForm) {
        productsForForm[productName as ProductName] = true;
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
    };

    setFormData(formDataForEdit);
    setSubmitError(null);
    setIsFormOpen(true);
    };

  // Generic input change handler for top-level and nested fields
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

  // Select change handler
  const handleSelectChange = (value: string, name: 'retailSoftware' | 'reservationSoftware') => {
    // Treat 'none' as undefined to match the schema
    setFormData(prev => ({ ...prev, [name]: value === 'none' ? undefined : value as FormState[typeof name] }));
  };

  const handleCheckboxChange = (checked: boolean, name: ProductName) => {
    setFormData(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [name]: checked,
      }
    }));
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _id: _, // Intentionally unused
        products,
        playbypoint: formPlayByPointData,
        latitude: latString, // Give the strings unique names
        longitude: lngString,
        ...basePayload // The rest of the data is already correctly typed
      } = formData;

      const rewardProductsPayload: string[] = [];
      for (const name of PRODUCT_NAMES) {
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
        
      // 4. Clean up other conditional fields.
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
          {!isMobile && (
            <GGAdminSidebar />
          )}

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
                <Flex direction="column" gap="3">
                  {clients.length > 0 ? clients.map(client => (
                    <Card key={client._id.toString()}>
                      <Flex gap="4" align="center">
                        <Avatar radius="full" size="3" src={client.icon || undefined} fallback={client.name.charAt(0).toUpperCase()}/>
                        <Box flexGrow={'1'}>
                          <Text as="div" weight="bold">{client.name}</Text>
                          <Text as="div" size="2" color="gray">ID: {client._id.toString()}</Text>
                        </Box>
                        <Button variant="soft" onClick={() => handleOpenEditDialog(client)}><Pencil2Icon /> Edit</Button>
                      </Flex>
                    </Card>
                  )) : (
                    <Text color="gray">No clients found. Create one to get started.</Text>
                  )}
                </Flex>
              )}
            </Flex>
          </Flex>
      </Flex>

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
              
              <Box>
                <Text as="div" size="2" mb="2" weight="bold">
                  Reward Products
                </Text>
                <Flex direction="column" gap="2">
                  {PRODUCT_NAMES.map(productName => (
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
              
              {/* --- Conditional Fields --- */}
              {formData.retailSoftware === 'shopify' && (
                <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                  <Heading size="3" mb="2">Shopify Config</Heading>
                  <Flex direction="column" gap="2">
                    <label><Text as="div" size="2" mb="1" weight="bold">Shop Domain</Text><TextField.Root name="shopify.shopDomain" value={formData.shopify.shopDomain || ''} onChange={handleInputChange} placeholder="example.myshopify.com" /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Access Token</Text><TextField.Root name="shopify.accessToken" value={formData.shopify.accessToken || ''} onChange={handleInputChange} /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Secret</Text><TextField.Root name="shopify.secret" value={formData.shopify.secret || ''} onChange={handleInputChange} /></label>
                  </Flex>
                </Box>
              )}

              {formData.reservationSoftware === 'playbypoint' && (
                <Box p="3" style={{ border: '1px solid var(--gray-a5)', borderRadius: 'var(--radius-3)' }}>
                  <Heading size="3" mb="2">PlayByPoint Config</Heading>
                  <Flex direction="column" gap="2">
                    <label>
                      <Text as="div" size="2" mb="1" weight="bold">Facility ID</Text>
                      <TextField.Root type="number" name="playbypoint.facilityId" value={formData.playbypoint.facilityId || ''} onChange={handleInputChange} />
                    </label>
                    <label>
                      <Text as="div" size="2" mb="1" weight="bold">Affiliations</Text>
                      <Tooltip content="Enter multiple values separated by a comma."><TextField.Root name="playbypoint.affiliations" value={formData.playbypoint.affiliations || ''} onChange={handleInputChange} placeholder="e.g., Affiliate A, Affiliate B" /></Tooltip>
                    </label>
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