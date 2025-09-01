'use client';

import { Button, Dialog, Flex } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";

export function CookieWarning() {
  const router = useRouter();
  const [cookiesBlocked, setCookiesBlocked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const checkCookies = () => {
      if (typeof navigator !== 'undefined' && !navigator.cookieEnabled) {
        console.warn('navigator.cookieEnabled reports cookies blocked.');
        return false;
      }
      try {
        document.cookie = "cookietest=1; SameSite=Lax";
        const cookiesEnabled = document.cookie.includes("cookietest=");
        document.cookie = "cookietest=1; Max-Age=0";
        return cookiesEnabled;
      } catch (err) {
        console.warn('Cookie set failed:', err);
        return false;
      }
    };

    if (!checkCookies()) {
      setCookiesBlocked(true);
      setOpen(true); // Open the dialog
    }
  }, []);

  if (!cookiesBlocked) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content>
        <Dialog.Title>Cookies are disabled</Dialog.Title>
        <Dialog.Description size="3" mb="4">
          Cookies are blocked or disabled. Guest accounts and certain features may not work correctly. Please enable cookies or create an account with email and password.
        </Dialog.Description>
        <Flex direction="row" gap="5" justify="between" mt="6" wrap={'wrap'}>
          <Dialog.Close>
            <Button variant="outline">Continue anyway</Button>
          </Dialog.Close>
          <Button onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/play')}>
            Create account
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
