'use client';

import { useState } from 'react';
import { AlertDialog, Box, Button, Checkbox, Dialog, Flex, ScrollArea, Spinner, Text, TextField } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useShopifyCatalog } from '@/app/hooks/useShopifyCatalog';
import {
  CatalogCollectionItem,
  CatalogProductItem,
  TargetSelection,
  isCollectionSelected,
  isProductSelected,
  selectionCountLabel,
  toggleCollection,
  toggleProduct,
} from '@/lib/rewards/discountTargetSelection';

interface ShopifyCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  title: string;
  selection: TargetSelection;
  onChange: (next: TargetSelection) => void;
  // Amount-off "Applies to → Specific products/Collections" locks this to
  // one type — no tab switcher shown. BXGY buys/gets allow 'both'.
  tabs: 'products' | 'collections' | 'both';
}

// A click that's about to select a NEW item of the type not currently
// represented — the one action that would clear the other type. Holding
// the item here (instead of applying the toggle immediately) is what lets
// the confirm step run BEFORE the clear happens rather than announcing it
// after the fact.
type PendingSwitch =
  | { type: 'product'; item: CatalogProductItem }
  | { type: 'collection'; item: CatalogCollectionItem };

export function ShopifyCatalogModal({
  open,
  onOpenChange,
  clientId,
  title,
  selection,
  onChange,
  tabs,
}: ShopifyCatalogModalProps) {
  const catalog = useShopifyCatalog({
    clientId,
    enabled: open,
    initialTab: tabs === 'collections' ? 'collections' : 'products',
    // 'both' (BXGY) keeps the in-modal Products/Collections toggle usable,
    // so no forced value — the hook manages its own tab via user clicks.
    // 'products'/'collections' (amount-off scope) has no in-modal
    // switcher, so this is the only thing keeping the fetched data in
    // sync when the parent's scope selection changes underneath it.
    forcedTab: tabs === 'both' ? undefined : tabs,
  });

  const effectiveTab = tabs === 'both' ? catalog.tab : tabs;

  // Only reachable when tabs === 'both' (BXGY) — the amount-off single-
  // type modal never renders the other type's rows at all, so this can't
  // trigger there regardless.
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  const handleToggleProduct = (item: CatalogProductItem) => {
    const isNewSelection = !isProductSelected(selection, item.productId);
    if (isNewSelection && selection.collections.length > 0) {
      // Ask first — don't apply the toggle yet.
      setPendingSwitch({ type: 'product', item });
      return;
    }
    onChange(toggleProduct(selection, item));
  };

  const handleToggleCollection = (item: CatalogCollectionItem) => {
    const isNewSelection = !isCollectionSelected(selection, item.collectionId);
    if (isNewSelection && selection.products.length > 0) {
      setPendingSwitch({ type: 'collection', item });
      return;
    }
    onChange(toggleCollection(selection, item));
  };

  const confirmPendingSwitch = () => {
    if (!pendingSwitch) return;
    if (pendingSwitch.type === 'product') {
      onChange(toggleProduct(selection, pendingSwitch.item));
    } else {
      onChange(toggleCollection(selection, pendingSwitch.item));
    }
    // onOpenChange(false) from AlertDialog.Action closing also clears
    // this, but setting it explicitly here avoids depending on that
    // ordering.
    setPendingSwitch(null);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="640px" style={{ padding: 0, overflow: 'hidden' }}>
          <Flex direction="column" gap="3" p="4" style={{ borderBottom: '0.5px solid var(--gray-5)' }}>
            <Dialog.Title size="4" mb="0">{title}</Dialog.Title>
            <Flex align="center" gap="3">
              <Box style={{ flex: 1 }}>
                <TextField.Root
                  placeholder="Search your Shopify catalog"
                  value={catalog.query}
                  onChange={(e) => catalog.setQuery(e.target.value)}
                >
                  <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
                </TextField.Root>
              </Box>
              {tabs === 'both' && (
                <Flex gap="1" style={{ flexShrink: 0 }}>
                  <Button
                    size="1"
                    radius="full"
                    variant={effectiveTab === 'products' ? 'solid' : 'soft'}
                  color={effectiveTab === 'products' ? "lime" : 'gray'}
                    onClick={() => catalog.setTab('products')}
                  >
                    Products
                  </Button>
                  <Button
                    size="1"
                    radius="full"
                    variant={effectiveTab === 'collections' ? 'solid' : 'soft'}
                  color={effectiveTab === 'collections' ? 'lime' : 'gray'}
                    onClick={() => catalog.setTab('collections')}
                  >
                    Collections
                  </Button>
                </Flex>
              )}
            </Flex>
          </Flex>

          <ScrollArea type="auto" style={{ height: 360 }}>
            <Flex direction="column">
              {effectiveTab === 'products'
                ? (catalog.items as CatalogProductItem[]).map((item) => {
                    const checked = isProductSelected(selection, item.productId);
                    const meta = [
                      item.price,
                      item.variantCount != null
                        ? `${item.variantCount} variant${item.variantCount === 1 ? '' : 's'}`
                        : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <Flex
                        key={item.productId}
                        align="center"
                        gap="3"
                        px="4"
                        py="2"
                        style={{ borderBottom: '0.5px solid var(--gray-3)', cursor: 'pointer' }}
                        onClick={() => handleToggleProduct(item)}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => handleToggleProduct(item)} />
                        <Flex direction="column" style={{ minWidth: 0 }}>
                          <Text size="2" weight="medium">{item.title}</Text>
                          {meta && <Text size="1" color="gray">{meta}</Text>}
                        </Flex>
                      </Flex>
                    );
                  })
                : (catalog.items as CatalogCollectionItem[]).map((item) => {
                    const checked = isCollectionSelected(selection, item.collectionId);
                    return (
                      <Flex
                        key={item.collectionId}
                        align="center"
                        gap="3"
                        px="4"
                        py="2"
                        style={{ borderBottom: '0.5px solid var(--gray-3)', cursor: 'pointer' }}
                        onClick={() => handleToggleCollection(item)}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => handleToggleCollection(item)} />
                        <Flex direction="column">
                          <Text size="2" weight="medium">{item.title}</Text>
                          {item.productCount != null && (
                            <Text size="1" color="gray">{item.productCount} products</Text>
                          )}
                        </Flex>
                      </Flex>
                    );
                  })}

              {!catalog.loading && catalog.items.length === 0 && !catalog.error && (
                <Flex justify="center" p="6">
                  <Text size="2" color="gray">Nothing matches that search. Try another term.</Text>
                </Flex>
              )}

              {catalog.error && (
                <Flex justify="center" p="6">
                  <Text size="2" color="red">{catalog.error}</Text>
                </Flex>
              )}

              {catalog.loading && (
                <Flex justify="center" p="4"><Spinner size="2" /></Flex>
              )}

              {!catalog.loading && catalog.hasNextPage && (
                <Flex justify="center" p="3">
                  <Button variant="soft" size="1" onClick={catalog.loadMore}>Load more</Button>
                </Flex>
              )}
            </Flex>
          </ScrollArea>

          <Flex
            justify="between"
            align="center"
            p="3"
            style={{ borderTop: '0.5px solid var(--gray-5)', backgroundColor: 'var(--gray-2)' }}
          >
            <Text size="2" color="gray">{selectionCountLabel(selection)}</Text>
            <Flex gap="2">
              <Button
              variant="outline"
              color='gray'
              radius="full"
                onClick={() => onChange({ products: [], collections: [] })}
              >
                Clear
              </Button>
            <Button
              color='lime'
              radius="full"
             onClick={() => onOpenChange(false)}>Done</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Confirm-before-clearing — a separate AlertDialog rather than
          nesting it inside Dialog.Content, so it layers cleanly above the
          catalog browser (Radix handles nested Dialog/AlertDialog
          portals independently of DOM position). */}
      <AlertDialog.Root
        open={!!pendingSwitch}
        onOpenChange={(isOpen) => !isOpen && setPendingSwitch(null)}
      >
        <AlertDialog.Content maxWidth="420px">
          <AlertDialog.Title>
            Switch to {pendingSwitch?.type === 'product' ? 'products' : 'collections'}?
          </AlertDialog.Title>
          <AlertDialog.Description size="2">
            {pendingSwitch?.type === 'product'
              ? `This will clear your ${selection.collections.length} selected collection${
                  selection.collections.length === 1 ? '' : 's'
                }.`
              : `This will clear your ${selection.products.length} selected product${
                  selection.products.length === 1 ? '' : 's'
                }.`}{' '}
            You can only pick products or collections here, not both.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" color="amber" onClick={confirmPendingSwitch}>
                Continue
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}