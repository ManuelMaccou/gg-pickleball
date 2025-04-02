"use client"

import { Button, Dialog, Flex } from "@radix-ui/themes";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface GuestDialogProps {
  showDialog: boolean;
  setShowDialog: (value: boolean) => void;
}

export default function GuestDialog({ showDialog, setShowDialog }: GuestDialogProps) {
  const router = useRouter();

  return (
    <Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
      <Dialog.Content>
        <Dialog.Title>You&apos;re on a guest account</Dialog.Title>
        <Dialog.Description size="3" mb="4">
          This match was temporarily saved. To make sure you don&apos;t lose your saved matches, create an account.
        </Dialog.Description>
        <Flex direction={'row'} gap={'9'} justify={'between'} mt={'6'}>
         
          <Button variant="outline" asChild><Link href={'/ggupr/new'}>Close</Link></Button>
          <Button onClick={() => router.push('/auth/login?screen_hint=signup&returnTo=/ggupr')}>Create account</Button>
        </Flex>
       
      </Dialog.Content>
    </Dialog.Root>
  );
}
