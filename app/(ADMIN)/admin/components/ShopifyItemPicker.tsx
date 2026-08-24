'use client';

import { useState } from 'react';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { ShopifyCatalogModal } from './ShopifyCatalogModal';
import { TargetSelection } from '@/lib/rewards/discountTargetSelection';

interface ShopifyItemPickerProps {
  clientId: string;
  label: string;
  help: string;
  selection: TargetSelection;
  onChange: (next: TargetSelection) => void;
  tabs: 'products' | 'collections' | 'both';
}

export function ShopifyItemPicker({
  clientId,
  label,
  help,
  selection,
  onChange,
  tabs,
}: ShopifyItemPickerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const chips = [
    ...selection.products.map((p) => ({
      key: `p:${p.productId}`,
      label: p.title,
      remove: () =>
        onChange({ ...selection, products: selection.products.filter((x) => x.productId !== p.productId) }),
    })),
    ...selection.collections.map((c) => ({
      key: `c:${c.collectionId}`,
      label: c.title,
      remove: () =>
        onChange({
          ...selection,
          collections: selection.collections.filter((x) => x.collectionId !== c.collectionId),
        }),
    })),
  ];

  return (
    <Card size="3">
      <Flex justify="between" align="start" gap="3" mb="3">
        <Box>
          <Text size="3" weight="bold" as="div">{label}</Text>
          <Text size="2" color="gray">{help}</Text>
        </Box>
        <Button radius="full" size="2" variant="soft" color="lime"
          style={{border: '1px solid var(--lime-10)'}}
          onClick={() => setModalOpen(true)}>
          <PlusIcon /> Browse catalog
        </Button>
      </Flex>

      {chips.length > 0 ? (
        <Flex
          direction="column"
          style={{ border: '0.5px solid var(--gray-5)', borderRadius: 12, overflow: 'hidden' }}
        >
          {chips.map((chip, i) => (
            <Flex
              key={chip.key}
              align="center"
              justify="between"
              px="3"
              py="2"
              style={{ borderBottom: i < chips.length - 1 ? '0.5px solid var(--gray-3)' : 'none' }}
            >
              <Text size="2">{chip.label}</Text>
              <Button size="1" variant="ghost" color="gray" onClick={chip.remove}>
                <Cross2Icon />
              </Button>
            </Flex>
          ))}
        </Flex>
      ) : (
        <Flex justify="center" p="4" style={{ border: '1px dashed var(--gray-6)', borderRadius: 12 }}>
          <Text size="2" color="gray">
            Nothing selected yet. Browse your catalog to pick products or collections.
          </Text>
        </Flex>
      )}

      <ShopifyCatalogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clientId={clientId}
        title={label}
        selection={selection}
        onChange={onChange}
        tabs={tabs}
      />
    </Card>
  );
}