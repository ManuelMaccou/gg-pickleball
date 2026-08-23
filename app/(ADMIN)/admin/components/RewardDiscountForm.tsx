// Destination: app/(BRAND)/admin/brand/components/RewardDiscountForm.tsx
'use client';

import { Badge, Box, Button, Callout, Card, Checkbox, Flex, SegmentedControl, Text, TextField } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Gift, Layers, Package, Percent, Store } from 'lucide-react';
import { ShopifyItemPicker } from './ShopifyItemPicker';
import { TargetSelection } from '@/lib/rewards/discountTargetSelection';
import {
  DiscountFormState,
  discountMutationInfo,
  discountPreviewText,
  discountSummaryText,
} from '@/lib/rewards/discountFormState';

interface RewardDiscountFormProps {
  clientId: string;
  value: DiscountFormState;
  onChange: (patch: Partial<DiscountFormState>) => void;
  editingLive?: boolean;
  // Pulled from the client's own card customization (see
  // RewardCardCustomizer) so the "what the player sees" preview actually
  // matches what ModernRewardCard will really show — same fallbacks that
  // component itself uses when a client hasn't customized these. Used by
  // both the brand admin and site admin pages, which each already have
  // the full client object in scope (no new fetch needed on either side).
  cardBackgroundImage?: string;
  cardBackgroundPosition?: string;
  cardTextColor?: string;
}

const LIME = '#a3e635';
const DEFAULT_CARD_BACKGROUND_IMAGE = '/rewardCardBackgrounds/defaultCardBackground.jpg';

function TypeOptionCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Flex
      direction="row"
      gap="2"
      p="4"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 14,
        border: `1px solid ${active ? LIME : 'var(--gray-5)'}`,
        backgroundColor: active ? 'rgba(163,230,53,0.08)' : 'white',
      }}
    >
      <Flex
        align="center"
        justify="center"
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(163,230,53,0.15)' }}
      >
        {icon}
      </Flex>
      <Flex direction="column" gap="1">
        <Text size="2" weight="bold">{title}</Text>
        <Text size="1" color="gray" style={{ lineHeight: 1.5 }}>{description}</Text>
    </Flex>
    </Flex>
  );
}

function ScopeOptionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      variant={active ? 'soft' : 'outline'}
      color={active ? undefined : 'gray'}
      radius="large"
      style={{
        flex: 1,
        border: `${active ? '1px' : '0px'} solid ${active ? LIME : 'var(--gray-5)'}`,
        backgroundColor: active ? 'rgba(163,230,53,0.08)' : 'white',
        color: 'var(--gray-12)',
        cursor: 'pointer',
        height: 44,
      }}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function RewardDiscountForm({
  clientId,
  value: state,
  onChange,
  editingLive,
  cardBackgroundImage,
  cardBackgroundPosition,
  cardTextColor,
}: RewardDiscountFormProps) {
  const isAmount = state.discountKind === 'amount';
  const isFree = state.getPercent === 100;
  const preview = discountPreviewText(state);
  const mutationInfo = discountMutationInfo(state);
  // Drives the "players see the specific list in their reward details"
  // caption below — only relevant once there's actually more than one
  // item for the title/summary to have collapsed into generic wording.
  const scopeHasMultipleItems = isAmount
    ? state.scope !== 'store' &&
      state.scopeSelection.products.length + state.scopeSelection.collections.length > 1
    : state.buysSelection.products.length + state.buysSelection.collections.length > 1 ||
      state.getsSelection.products.length + state.getsSelection.collections.length > 1;

  // Real client card customization, with the same fallbacks
  // ModernRewardCard itself uses — so this preview is accurate whether or
  // not the client has customized their card.
  const previewBgImage = cardBackgroundImage || DEFAULT_CARD_BACKGROUND_IMAGE;
  const previewBgPosition = cardBackgroundPosition || 'center';
  const previewTextColor = cardTextColor || '#ffffff';

  return (
    <Flex gap="7" align="start" wrap="wrap">
      {/* ── Left: the form ── */}
      <Flex pb="9" direction="column" gap="4" style={{ flex: '1 1 480px', minWidth: 380, width: "66%" }}>
        {editingLive && (
          <Callout.Root color="amber" size="1">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>
              You're editing a live reward. Changes apply to codes issued from now on. Codes already in
              players' hands keep the terms they were created with.
            </Callout.Text>
          </Callout.Root>
        )}

        <Card size="3">
          <Text size="3" weight="bold" as="div" mb="3">Discount type</Text>
          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <TypeOptionCard
                active={isAmount}
                icon={<Percent size={16} color="#3f6212" />}
                title="Amount off"
                description="Percent or dollars off."
                onClick={() => onChange({ discountKind: 'amount' })}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <TypeOptionCard
                active={!isAmount}
                icon={<Gift size={16} color="#3f6212" />}
                title="Buy X, get Y"
                description="Buy one thing, get another."
                onClick={() => onChange({ discountKind: 'bxgy' })}
              />
            </Box>
          </Flex>
        </Card>

        {isAmount && (
          <Card size="3">
            <Text size="3" weight="bold" as="div" mb="3">Applies to</Text>
            <Flex gap="2">
              <ScopeOptionButton
                active={state.scope === 'store'}
                label="Entire store"
                onClick={() => onChange({ scope: 'store' })}
              />
              <ScopeOptionButton
                active={state.scope === 'products'}
                label="Specific products"
                onClick={() => onChange({ scope: 'products' })}
              />
              <ScopeOptionButton
                active={state.scope === 'collections'}
                label="Collections"
                onClick={() => onChange({ scope: 'collections' })}
              />
            </Flex>
          </Card>
        )}

        {isAmount && state.scope !== 'store' && (
          <ShopifyItemPicker
            clientId={clientId}
            label="Products and collections in this discount"
            help="Pick whichever products or collections should be discounted."
            selection={state.scopeSelection}
            onChange={(next: TargetSelection) => onChange({ scopeSelection: next })}
            tabs={state.scope === 'products' ? 'products' : 'collections'}
          />
        )}

        {!isAmount && (
          <>
            <ShopifyItemPicker
              clientId={clientId}
              label="Customer buys"
              help="The qualifying purchase. Products or a whole collection."
              selection={state.buysSelection}
              onChange={(next: TargetSelection) => onChange({ buysSelection: next })}
              tabs="both"
            />
            <ShopifyItemPicker
              clientId={clientId}
              label="Customer gets"
              help="What gets discounted once they qualify."
              selection={state.getsSelection}
              onChange={(next: TargetSelection) => onChange({ getsSelection: next })}
              tabs="both"
            />
          </>
        )}

        <Card size="3">
          <Text size="3" weight="bold" as="div" mb="4">
            {isAmount ? 'Discount value' : 'Offer details'}
          </Text>

          {isAmount ? (
            <Flex gap="6" wrap="wrap" align="end">
              <Flex direction="column" gap="1">
                <Text size="1" weight="bold" color="gray">Discount value</Text>
                <Flex align="center" gap="2">
                  <TextField.Root
                    type="number"
                    style={{ width: 120 }}
                    value={state.amountValue ?? ''}
                    onChange={(e) => onChange({ amountValue: Number(e.target.value) || null })}
                  >
                    {state.amountType === 'dollars' && <TextField.Slot>$</TextField.Slot>}
                    {state.amountType === 'percent' && <TextField.Slot side="right">%</TextField.Slot>}
                  </TextField.Root>
                  <SegmentedControl.Root
                    style={{ background:'#dbe7ee' }}
                    radius='full'
                    value={state.amountType}
                    onValueChange={(v) => onChange({ amountType: v as 'percent' | 'dollars' })}
                  >
                    <SegmentedControl.Item value="percent">Percent</SegmentedControl.Item>
                    <SegmentedControl.Item value="dollars">Dollar</SegmentedControl.Item>
                  </SegmentedControl.Root>
                </Flex>
              </Flex>

              {state.amountType === 'dollars' && (
                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold" color="gray">Minimum cart amount</Text>
                  <TextField.Root
                    type="number"
                    style={{ width: 130 }}
                    value={state.minimumSpend ?? ''}
                    onChange={(e) => onChange({ minimumSpend: Number(e.target.value) || null })}
                  >
                    <TextField.Slot>$</TextField.Slot>
                  </TextField.Root>
                </Flex>
              )}
            </Flex>
          ) : (
            <Flex gap="6" wrap="wrap" align="end">
              {/* Quantity fields removed on purpose — BXGY is always buy 1,
                  get 1. state.buyQuantity/getQuantity stay at their
                  DEFAULT_DISCOUNT_FORM_STATE value of 1 since nothing here
                  calls onChange on them anymore; everything downstream
                  (friendlyName, the Shopify mutation, validation) already
                  just reads whatever's in state, so nothing else needed
                  to change for this. */}
              <Flex direction="column" gap="1">
                <Text size="1" weight="bold" color="gray">Discount on the get item</Text>
                <Flex align="center" gap="2">
                  <SegmentedControl.Root
                    style={{ background:'#dbe7ee' }}
                    radius='full'
                    value={isFree ? 'free' : 'percent'}
                    onValueChange={(v) =>
                      onChange({ getPercent: v === 'free' ? 100 : state.getPercent === 100 ? 50 : state.getPercent })
                    }
                  >
                    <SegmentedControl.Item value="percent">Percent off</SegmentedControl.Item>
                    <SegmentedControl.Item value="free">Free</SegmentedControl.Item>
                  </SegmentedControl.Root>
                  {!isFree && (
                    <TextField.Root
                      type="number"
                      style={{ width: 96 }}
                      value={state.getPercent ?? ''}
                      onChange={(e) => onChange({ getPercent: Number(e.target.value) || null })}
                    >
                      <TextField.Slot side="right">%</TextField.Slot>
                    </TextField.Root>
                  )}
                </Flex>
              </Flex>
            </Flex>
          )}

          <Box my="4" style={{ height: 1, backgroundColor: 'var(--gray-4)' }} />

          <Flex
            gap="3"
            align="start"
            style={{ cursor: 'pointer' }}
            onClick={() => onChange({ combinesWithOtherDiscounts: !state.combinesWithOtherDiscounts })}
          >
            <Checkbox
              checked={state.combinesWithOtherDiscounts}
              onCheckedChange={(checked) => onChange({ combinesWithOtherDiscounts: !!checked })}
            />
            <Flex direction="column" gap="1">
              <Text size="2" weight="bold">Combines with other discounts</Text>
              <Text size="1" color="gray">
                Players can stack this reward with product and order discounts already running in your store.
              </Text>
            </Flex>
          </Flex>
        </Card>
      </Flex>

      {/* ── Right: sticky preview + summary ── */}
      {/* top: 96 is an estimate of the page header's stuck height (title +
          buttons row, ~80px, plus a little breathing room) — the page and
          this panel are two independently-sticky elements sharing the same
          scroll container, tuned to travel together rather than actually
          merged. Re-check this number against the real rendered header
          height and adjust if they don't line up. */}
      <Flex direction="column" gap="4" style={{ width: '33%', flexShrink: 0, position: 'sticky', top: 96 }}>
        <Box p="5" style={{ backgroundColor: '#0a0a0a', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '15px' }}>
          <Text size="1" weight="bold" style={{ letterSpacing: '0.08em', color: LIME }}>WHAT THE PLAYER SEES</Text>

          <Box
            mt="3"
            style={{
              position: 'relative',
              height: 300,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {/* Full-card background image — a plain div, matching
                ModernRewardCard's exact approach rather than putting the
                background on the Radix Box itself, so there's no question
                of whether Box forwards these style props the same way. */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${previewBgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: previewBgPosition,
            }} />

            {/* Mirrors ModernRewardCard's full-card darkening gradient */}
            <div style={{
              position: 'absolute', inset: 0,
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 30%, ' +
                'rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.75) 100%)',
            }} />

            {/* Bottom-anchored group: reward-name text directly above the
                translucent panel. Anchored via position:absolute/bottom:0
                directly (no logo row exists in this preview to justify
                space-between against, unlike the real card) — this is the
                actual fix: the previous version claimed this sat at the
                bottom in a comment, but had no positioning that actually
                did that, so it rendered at the normal top-of-flow spot
                instead. */}
            <Flex direction="column" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <Flex direction="column" gap="1" px="4" pb="3">
                <Text size="3" weight="bold" style={{
                  color: previewTextColor, lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  {preview.title}
                </Text>
                <Text size="2" style={{
                  color: previewTextColor, lineHeight: 1.5, whiteSpace: 'pre-line',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}>
                  {preview.terms}
                </Text>
              </Flex>

              <Flex direction="column" gap="2" p="4" style={{
                backgroundColor: 'rgba(10,10,10,0.55)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Flex
                  align="center"
                  justify="between"
                  px="3"
                  py="2"
                  style={{ border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8 }}
                >
                  <Text size="2" weight="bold" style={{ color: LIME, fontFamily: 'monospace' }}>GGXXXXXX</Text>
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.4)' }}>Generated at reward issuance</Text>
                </Flex>
                {scopeHasMultipleItems && (
                  <Text size="1" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    ** Players see the specific product names when they open this reward's details.
                  </Text>
                )}
              </Flex>
            </Flex>
          </Box>
        </Box>

        <Card size="3">
          <Text size="2" weight="bold" as="div" mb="2">Summary</Text>
          <Text size="2" color="gray" style={{ lineHeight: 1.5 }}>{discountSummaryText(state)}</Text>
        </Card>
      </Flex>
    </Flex>
  );
}