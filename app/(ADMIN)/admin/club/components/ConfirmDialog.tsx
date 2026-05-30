'use client';

import { Dialog, Button, Flex, Text } from '@radix-ui/themes';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirming?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  confirming = false,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="420px"
        style={{ backgroundColor: '#111', border: '0.5px solid rgba(255,255,255,0.1)' }}
      >
        <Dialog.Title style={{ color: '#fff' }}>{title}</Dialog.Title>
        <Dialog.Description size="2" mb="5" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {description}
        </Dialog.Description>
        <Flex gap="3" justify="end">
          <Button
            variant="soft"
            color="gray"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            style={{ cursor: 'pointer' }}
          >
            {cancelLabel}
          </Button>
          <Button
            color={destructive ? 'red' : 'green'}
            onClick={onConfirm}
            disabled={confirming}
            style={{ cursor: confirming ? 'default' : 'pointer' }}
          >
            {confirming ? 'Deleting…' : confirmLabel}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}