'use client'

import { useEffect, useState } from "react";
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useUserContext } from "@/app/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Avatar, Box, Button, Callout, Card, Dialog, Flex, Heading, Select, Spinner, Text, TextField, Tooltip } from "@radix-ui/themes";
import { InfoCircledIcon, Pencil2Icon } from "@radix-ui/react-icons"
import Image from "next/image";
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { IClient, PodplayData, ShopifyData } from "@/app/types/databaseTypes";
import GGAdminSidebar from "../components/GGAdminSidebar";


// A specific type for the form's state, ensuring nested objects always exist.
type FormState = {
  _id?: string;
  name: string;
  logo: string;
  admin_logo: string;
  icon: string;
  latitude: string;
  longitude: string;
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

  // Admin and general page state
  // const [admin, setAdmin] = useState<IAdmin | null>(null);
  // const [location, setLocation] = useState<IClient | null>(null);
  // const [adminError, setAdminError] = useState<string | null>(null);
  // const [isGettingAdmin, setIsGettingAdmin] = useState<boolean>(true);

  // Client-specific state
  const [clients, setClients] = useState<IClient[]>([]);
  const [isFetchingClients, setIsFetchingClients] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Form and Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<IClient | null>(null);
  const [formData, setFormData] = useState<FormState>(initialClientState);

  // Fetch admin data for header consistency
  /*
  useEffect(() => {
    if (!user?.id) return;
    const getAdminUser = async () => {
      try {
        const response = await fetch(`/api/admin?userId=${user.id}`);
        if (response.status === 204) { setAdminError("You don't have permission to access this page."); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch admin data");
        setAdmin(data.admin);
        setLocation(data.admin.location);
      } catch (error: unknown) {
        if (error instanceof Error) {
          setAdminError(error.message);
        } else {
          setAdminError("An unknown error occurred while fetching admin data.");
        }
      } finally {
        setIsGettingAdmin(false);
      }
    };
    getAdminUser();
  }, [user?.id]);
  */

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

  // Handler for opening the 'Edit' dialog
  const handleOpenEditDialog = (client: IClient) => {
    setSelectedClientForEdit(client);
    // Deep copy and format data for the form, ensuring all nested objects are initialized
    setFormData({
      ...initialClientState,
      ...client, // <-- Simply spread the client object directly
      _id: client._id.toString(), 
      shopify: client.shopify || initialClientState.shopify,
      podplay: client.podplay || initialClientState.podplay,
      playbypoint: {
        facilityId: client.playbypoint?.facilityId || '',
        affiliations: client.playbypoint?.affiliations?.join(', ') || ''
      },
    });
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

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Destructure formData to separate the part that needs transformation.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
     const { _id: _, playbypoint: formPlayByPointData, ...clientData } = formData;

      // 2. Create the payload from the data that is already correctly typed.
      const payload: Partial<Omit<IClient, keyof Document>> = {
        ...clientData,
      };

      // 3. Transform the form's playbypoint data and add it to the payload.
      if (payload.reservationSoftware === 'playbypoint') {
        payload.playbypoint = {
          facilityId: formPlayByPointData.facilityId ? Number(formPlayByPointData.facilityId) : undefined,
          affiliations: formPlayByPointData.affiliations.split(',').map(s => s.trim()).filter(Boolean),
        };
      }
      
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
            <Flex direction="column" gap="3">
              <label><Text as="div" size="2" mb="1" weight="bold">Name *</Text>
                <TextField.Root name="name" value={formData.name || ''} onChange={handleInputChange} required />
              </label>
              <label><Text as="div" size="2" mb="1" weight="bold">Logo URL (for players)</Text>
                <TextField.Root name="logo" value={formData.logo || ''} onChange={handleInputChange} />
              </label>
              <label><Text as="div" size="2" mb="1" weight="bold">Admin Logo URL (for this dashboard)</Text>
                <TextField.Root name="admin_logo" value={formData.admin_logo || ''} onChange={handleInputChange} />
              </label>
              <label><Text as="div" size="2" mb="1" weight="bold">Icon URL</Text>
                <TextField.Root  name="icon" value={formData.icon || ''} onChange={handleInputChange} />
              </label>

              <Flex direction={{ initial: 'column', sm: 'row' }} gap="3">
                <label style={{ flex: 1 }}><Text as="div" size="2" mb="1" weight="bold">Reservation Software</Text>
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
                    <label><Text as="div" size="2" mb="1" weight="bold">Facility ID</Text><TextField.Root type="number" name="playbypoint.facilityId" value={formData.playbypoint.facilityId || ''} onChange={handleInputChange} /></label>
                    <label><Text as="div" size="2" mb="1" weight="bold">Affiliations</Text><Tooltip content="Enter multiple values separated by a comma."><TextField.Root name="playbypoint.affiliations" value={formData.playbypoint.affiliations || ''} onChange={handleInputChange} placeholder="Affiliate A, Affiliate B" /></Tooltip></label>
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