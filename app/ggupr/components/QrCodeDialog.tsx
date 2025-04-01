"use client"

import { Button, Dialog, Flex, VisuallyHidden } from "@radix-ui/themes";
import QRCodeGenerator from "./QrCodeGenerator";

interface QrCodeDialogProps {
  matchId: string;
  selectedLocation: string;
}

const QrCodeDialog: React.FC<QrCodeDialogProps> = ({ matchId, selectedLocation }) => {

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button variant="soft">Show QR code</Button>
      </Dialog.Trigger>

      <Dialog.Content>
        <Flex direction={'column'} gap={'5'} align={'center'}>
        <Dialog.Title>Scan to join match</Dialog.Title>
        <VisuallyHidden>
          <Dialog.Description>Scan QR code to join match</Dialog.Description>
        </VisuallyHidden>
        <QRCodeGenerator matchId={matchId} selectedLocation={selectedLocation}/>
        <Dialog.Close>
          <Button size={'3'} mt={'5'} variant="outline">Close</Button>
        </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default QrCodeDialog;
