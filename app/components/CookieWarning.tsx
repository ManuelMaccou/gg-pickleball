'use client';

import { Button, Dialog, Flex } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";

export function CookieWarning() {
  const router = useRouter();
  const [cookiesBlocked, setCookiesBlocked] = useState(false);

  useEffect(() => {
    const checkCookies = () => {
      try {
        document.cookie = "cookietest=1; SameSite=Lax";
        const cookiesEnabled = document.cookie.includes("cookietest=");
        // Cleanup test cookie if possible
        document.cookie = "cookietest=1; Max-Age=0";
        return cookiesEnabled;
      } catch (err) {
        console.warn('Cookie check failed:', err);
        return false;
      }
    };

    if (!checkCookies()) {
      setCookiesBlocked(true);
    }
  }, []);

  if (!cookiesBlocked) return null;

  return (
    <Dialog.Root open={cookiesBlocked}>
      <Dialog.Content>
        <Dialog.Title>Cookies are disabled</Dialog.Title>
        <Dialog.Description size="3" mb="4">
          ⚠️ Cookies are blocked or disabled. Guest accounts and certain features may not work correctly. Please enable cookies or create a full account.
        </Dialog.Description>
        <Flex direction="row" gap="9" justify="between" mt="6">
          <Dialog.Close>
            <Button variant="outline">Continue anyway</Button>
          </Dialog.Close>
          <Button onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/')}>
            Create account
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
