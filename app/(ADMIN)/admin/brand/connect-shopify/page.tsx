'use client'

import { useEffect, useState } from 'react';
import { Flex, Card, Heading, Text, TextField, Button, Callout, Spinner, Box } from '@radix-ui/themes';
import { InfoCircledIcon, LockClosedIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { useUserContext } from '@/app/contexts/UserContext';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import darkGgLogo from '../../../../../public/logos/gg_logo_black_transparent.png'; // Adjust path if needed

export default function ShopifyOnboardingPage() {
  const { user } = useUserContext();
  const { isLoading: isAuthLoading } = useAuth0User();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [shopDomain, setShopDomain] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [fullyConnectedToShopify, setFullyConnectedToShopify] = useState<boolean>(false);

  // 1. Check Admin Permissions
  useEffect(() => {
    // If auth is still loading, wait.
    if (isAuthLoading) return;

    // If not logged in, stop checking admin (we will show login screen).
    if (!user) {
      setIsAdminChecking(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const res = await fetch(`/api/admin?userId=${user.id}`);
        if (res.status === 200) {
          const data = await res.json();
          setIsAdmin(true);
          // Optional: Pre-fill shop domain if they already have one connected?
          if (data.admin?.location?.shopify?.shopDomain) {
            setConnectedShop(data.admin.location.shopify.shopDomain);
            setShopDomain(data.admin.location.shopify.shopDomain);
          }
          if (data.admin?.location?.shopify?.shopDomain && data.admin?.location?.shopify?.accessToken) {
            setFullyConnectedToShopify(true);
          }
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error("Failed to check admin permissions", e);
        setIsAdmin(false);
      } finally {
        setIsAdminChecking(false);
      }
    };

    checkAdmin();
  }, [user, isAuthLoading]);

  // 2. Check for Success/Error Query Params (from Callback)
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
        setConnectedShop(searchParams.get('connected_shop') || 'your store');
    }
    if (searchParams.get('error')) {
        setInstallError("Installation failed. Please try again.");
    }
  }, [searchParams]);

  const handleInstall = () => {
    setInstallError(null);
    setIsRedirecting(true);

    let cleanDomain = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (!cleanDomain.includes('.')) {
        // If they just typed "mystore", assume myshopify.com
        cleanDomain = `${cleanDomain}.myshopify.com`;
    } else if (!cleanDomain.includes('.myshopify.com')) {
        // Strict check for safety, though you could allow custom domains if you handle them
        setInstallError("Please enter your .myshopify.com domain (e.g. store.myshopify.com)");
        setIsRedirecting(false);
        return;
    }

    // Redirect to our API install route
    window.location.href = `/api/shopify/install?shop=${cleanDomain}`;
  };

  const handleLogin = () => {
    // Redirect to login, then come back here
    const returnUrl = encodeURIComponent('/admin/brand/connect-shopify');
    router.push(`/auth/login?returnTo=${returnUrl}`);
  };

  // --- RENDER STATES ---

  // 1. Loading
  if (isAuthLoading || isAdminChecking) {
    return <Flex justify="center" align="center" height="100vh"><Spinner size="3" /></Flex>;
  }

  // 2. Not Logged In
  if (!user) {
    return (
      <Flex direction="column" justify="center" align="center" style={{ height: '100vh', backgroundColor: '#F9FAFB' }}>
        <Card size="4" style={{ maxWidth: 450, width: '100%', padding: '32px' }}>
          <Flex direction="column" gap="5" align="center">
            <Image src={darkGgLogo} alt="Logo" height={40} width={80} style={{ objectFit: 'contain' }} />
            <Flex direction="column" align="center" gap="2">
                <Heading size="6">Admin Access Required</Heading>
                <Text align="center" color="gray">
                Please log in to connect your Shopify store.
                </Text>
            </Flex>
            <Button size="3" onClick={handleLogin} style={{ width: '100%' }}>
              Log In
            </Button>
          </Flex>
        </Card>
      </Flex>
    );
  }

  // 3. Logged In but Not Admin
  if (!isAdmin) {
    return (
      <Flex direction="column" justify="center" align="center" style={{ height: '100vh', backgroundColor: '#F9FAFB' }}>
        <Card size="4" style={{ maxWidth: 450, width: '100%', padding: '32px' }}>
          <Flex direction="column" gap="4" align="center">
            <LockClosedIcon width="40" height="40" color="var(--gray-8)" />
            <Heading size="6">Access Denied</Heading>
            <Text align="center" color="gray">
              You do not have permission to view this page. Please contact your super administrator.
            </Text>
            <Button variant="soft" color="gray" onClick={() => router.push('/')}>Go Home</Button>
          </Flex>
        </Card>
      </Flex>
    );
  }

  // 4. Success State (Already Connected)
  if (fullyConnectedToShopify && !searchParams.get('reconnect')) {
      return (
        <Flex direction="column" justify="center" align="center" style={{ height: '100vh', backgroundColor: '#F9FAFB' }}>
            <Card size="4" style={{ maxWidth: 500, width: '100%', padding: '32px' }}>
                <Flex direction="column" gap="5" align="center">
                    <CheckCircledIcon width="60" height="60" color="green" />
                    <Heading size="6" align="center">Shopify Connected!</Heading>
                    <Text align="center" size="3">
                        Your store <Text weight="bold">{connectedShop}</Text> is successfully connected.
                    </Text>
                    <Text align="center" color="gray">
                        Reward codes generated by players will now automatically sync to your Shopify discounts.
                    </Text>
                    
                    <Flex gap="3" mt="2" align={'center'}>
                        <Button variant="soft" onClick={() => router.push('/admin/brand')}>
                            Go to Dashboard
                        </Button>
                        <Button 
                          variant="ghost" 
                          color="gray" 
                          onClick={() => {
                            setConnectedShop(null);
                            setFullyConnectedToShopify(false);
                          }}
                        >
                          Reconnect / Change Store
                        </Button>
                    </Flex>
                </Flex>
            </Card>
        </Flex>
      )
  }

  // 5. Main Onboarding Form
  return (
    <Flex justify="center" align="center" style={{ height: '100vh', backgroundColor: '#F9FAFB' }}>
      <Card size="4" style={{ maxWidth: 500, width: '100%', padding: '32px' }}>
        <Flex direction="column" gap="5">
          <Flex justify="center">
             <Image src={darkGgLogo} alt="Logo" height={40} width={80} style={{ objectFit: 'contain' }} />
          </Flex>
          
          <Box>
            <Heading align="center" mb="2">Connect Shopify</Heading>
            <Text align="center" color="gray" as="p">
                Enter your Shopify store domain to enable automated reward discounts.
            </Text>
          </Box>

          {installError && (
            <Callout.Root color="red">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>{installError}</Callout.Text>
            </Callout.Root>
          )}

          <Flex direction="column" gap="2">
            <Text size="2" weight="bold">Shop Domain</Text>
            <TextField.Root 
              placeholder="my-store.myshopify.com" 
              size="3"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
            >
              <TextField.Slot>https://</TextField.Slot>
            </TextField.Root>
          </Flex>

          <Button size="4" onClick={handleInstall} disabled={isRedirecting || !shopDomain}>
            {isRedirecting ? <Spinner /> : 'Install App'}
          </Button>
          
          <Text size="1" align="center" color="gray">
            You will be redirected to Shopify to approve permissions.
          </Text>
        </Flex>
      </Card>
    </Flex>
  );
}