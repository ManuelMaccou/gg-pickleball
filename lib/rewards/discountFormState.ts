// Destination: lib/rewards/discountFormState.ts

import { IReward } from '@/app/types/databaseTypes';
import {
  EMPTY_SELECTION,
  TargetSelection,
  formatItemList,
  itemsLabel,
  selectionIsEmpty,
  selectionIsMixed,
  selectionTitles,
} from './discountTargetSelection';

export interface DiscountFormState {
  discountKind: 'amount' | 'bxgy';

  // Amount off
  amountValue: number | null;
  amountType: 'percent' | 'dollars';
  minimumSpend: number | null;
  scope: 'store' | 'products' | 'collections';
  scopeSelection: TargetSelection;

  // Buy X, get Y — buys/gets can never be scope 'store'; Shopify's BXGY
  // mutation has no "all" option, confirmed against current API docs.
  buyQuantity: number | null;
  getQuantity: number | null;
  getPercent: number | null; // 100 == free
  buysSelection: TargetSelection;
  getsSelection: TargetSelection;

  // Shared
  combinesWithOtherDiscounts: boolean;
}

export const DEFAULT_DISCOUNT_FORM_STATE: DiscountFormState = {
  discountKind: 'amount',
  amountValue: null,
  amountType: 'percent',
  minimumSpend: null,
  scope: 'store',
  scopeSelection: EMPTY_SELECTION,
  buyQuantity: 1,
  getQuantity: 1,
  getPercent: 100,
  buysSelection: EMPTY_SELECTION,
  getsSelection: EMPTY_SELECTION,
  combinesWithOtherDiscounts: false,
};

function toTargetSelection(sel?: IReward['shopifyTargeting'] | null): TargetSelection {
  return {
    products: sel?.products?.map((p) => ({ productId: p.productId, title: p.title })) ?? [],
    collections: sel?.collections?.map((c) => ({ collectionId: c.collectionId, title: c.title })) ?? [],
  };
}

// Reconstructs form state from a persisted Reward — used when opening the
// edit view for an existing reward. Absent/legacy rewards (no discountKind
// at all) fall back to today's implicit behavior: amount off, entire store.
export function discountFormStateFromReward(reward: Partial<IReward> | null | undefined): DiscountFormState {
  if (!reward) return DEFAULT_DISCOUNT_FORM_STATE;

  if (reward.discountKind === 'bxgy' && reward.bxgy) {
    return {
      ...DEFAULT_DISCOUNT_FORM_STATE,
      discountKind: 'bxgy',
      buyQuantity: reward.bxgy.buyQuantity ?? 1,
      getQuantity: reward.bxgy.getQuantity ?? 1,
      getPercent: reward.bxgy.getPercent ?? 100,
      buysSelection: toTargetSelection(reward.bxgy.buys),
      getsSelection: toTargetSelection(reward.bxgy.gets),
      combinesWithOtherDiscounts: reward.combinesWithOtherDiscounts ?? false,
    };
  }

  const targeting = reward.shopifyTargeting;
  const scope: DiscountFormState['scope'] =
    !targeting || targeting.all
      ? 'store'
      : (targeting.products?.length ?? 0) > 0
      ? 'products'
      : (targeting.collections?.length ?? 0) > 0
      ? 'collections'
      : 'store';

  return {
    ...DEFAULT_DISCOUNT_FORM_STATE,
    discountKind: 'amount',
    amountValue: reward.discount ?? null,
    amountType: reward.type === 'dollars' ? 'dollars' : 'percent',
    minimumSpend: reward.minimumSpend ?? null,
    scope,
    scopeSelection: toTargetSelection(targeting),
    combinesWithOtherDiscounts: reward.combinesWithOtherDiscounts ?? false,
  };
}

// Builds the fields to merge into the reward payload on save. Only needs
// to send the fields for the CURRENT discount kind — PATCH /api/reward
// already $unsets whatever the other kind would have left behind (mirrors
// the existing product === 'custom' branch's handling of discount/type),
// so nothing here needs to explicitly null out the other shape.
export function buildRewardPayloadFields(state: DiscountFormState): Partial<IReward> {
  if (state.discountKind === 'bxgy') {
    return {
      discountKind: 'bxgy',
      bxgy: {
        buys: { products: state.buysSelection.products, collections: state.buysSelection.collections },
        buyQuantity: state.buyQuantity ?? 1,
        gets: { products: state.getsSelection.products, collections: state.getsSelection.collections },
        getQuantity: state.getQuantity ?? 1,
        getPercent: state.getPercent ?? 100,
      },
      combinesWithOtherDiscounts: state.combinesWithOtherDiscounts,
    };
  }

  return {
    discountKind: 'amount',
    type: state.amountType === 'dollars' ? 'dollars' : 'percent',
    discount: state.amountValue ?? 0,
    minimumSpend: state.amountType === 'dollars' ? state.minimumSpend ?? undefined : undefined,
    shopifyTargeting:
      state.scope === 'store'
        ? { all: true }
        : { products: state.scopeSelection.products, collections: state.scopeSelection.collections },
    combinesWithOtherDiscounts: state.combinesWithOtherDiscounts,
  };
}

export function validateDiscountForm(state: DiscountFormState): string | null {
  if (state.discountKind === 'amount') {
    if (!state.amountValue || state.amountValue <= 0) return 'Discount amount must be greater than 0.';
    if (state.amountType === 'percent' && state.amountValue > 100) return 'Percentage discount cannot exceed 100%.';
    if (state.scope !== 'store') {
      if (selectionIsEmpty(state.scopeSelection)) {
        return 'Choose at least one product or collection, or switch to Entire store.';
      }
      if (selectionIsMixed(state.scopeSelection)) {
        return 'Choose either products or collections for this discount, not both.';
      }
    }
    return null;
  }

  if (!state.buyQuantity || state.buyQuantity <= 0) return 'Buy quantity must be at least 1.';
  if (!state.getQuantity || state.getQuantity <= 0) return 'Get quantity must be at least 1.';
  if (!state.getPercent || state.getPercent <= 0 || state.getPercent > 100) {
    return 'Discount on the get item must be between 1 and 100%.';
  }
  if (selectionIsEmpty(state.buysSelection)) return 'Choose what the customer must buy.';
  if (selectionIsEmpty(state.getsSelection)) return 'Choose what the customer gets.';
  if (selectionIsMixed(state.buysSelection)) {
    return 'Choose either products or collections for what the customer buys, not both.';
  }
  if (selectionIsMixed(state.getsSelection)) {
    return 'Choose either products or collections for what the customer gets, not both.';
  }
  return null;
}

// Player-facing summary of a scope: the actual name when there's exactly
// one item, or natural "select ___" copy when there's more than one —
// NOT a count ("2 products · 1 collection" reads like admin inventory
// output, not a reward name). The full list of names, when there's more
// than one, belongs in the reward detail view instead (formatItemList in
// discountTargetSelection.ts) — see RewardDetailView.tsx.
export function targetSummaryText(sel: TargetSelection): string {
  const total = sel.products.length + sel.collections.length;
  if (total === 0) return '(Choose an item)';
  if (total === 1) return (sel.products[0] ?? sel.collections[0]).title;
  return 'select products';
}

export function discountSummaryText(state: DiscountFormState): string {
  if (state.discountKind === 'amount') {
    const amt = state.amountType === 'percent' ? `${state.amountValue ?? 0}% off` : `$${state.amountValue ?? 0} off`;
    const scopeText = state.scope === 'store' ? 'everything in your store' : targetSummaryText(state.scopeSelection);
    const minSpendText =
      state.amountType === 'dollars' && state.minimumSpend ? `, on carts of $${state.minimumSpend} or more` : '';
    return `${amt} ${scopeText}${minSpendText}.`;
  }

  const buysText = targetSummaryText(state.buysSelection);
  const getsText = targetSummaryText(state.getsSelection);
  const off = state.getPercent === 100 ? 'free' : `${state.getPercent ?? 0}% off`;
  return `Buy ${state.buyQuantity ?? 1} × ${buysText}, get ${state.getQuantity ?? 1} × ${getsText} ${off}.`;
}

export function discountPreviewText(state: DiscountFormState): { title: string; terms: string } {
  if (state.discountKind === 'amount') {
    const amt = state.amountType === 'percent' ? `${state.amountValue ?? 0}% off` : `$${state.amountValue ?? 0} off`;
    const scopeText = state.scope === 'store' ? 'your order' : targetSummaryText(state.scopeSelection);
    const title = `${amt} ${scopeText}`;

    // Only add a specifics sentence when the title itself went generic
    // ("select products") — a single named item already says everything
    // in the title, so repeating it here would be redundant.
    const scopeTitles = selectionTitles(state.scopeSelection);
    const specificsSentence =
      state.scope !== 'store' && scopeTitles.length > 1 ? `Applies to: ${formatItemList(scopeTitles)}. ` : '';

    const minSpendSentence =
      state.amountType === 'dollars' && state.minimumSpend
        ? `Spend $${state.minimumSpend} or more to use this code.`
        : 'Applies at checkout.';
    const terms =
      specificsSentence +
      minSpendSentence +
      (state.combinesWithOtherDiscounts
        ? ' May combine with some other store discounts.'
        : ' Cannot be combined with other discounts.');
    return { title, terms };
  }

  // BXGY titles never name specific items, even for a single selection —
  // a collection can be named anything, and "Buy Shirts" reads ambiguously
  // regardless of whether Shirts is a product or a collection. The title
  // is always quantity + discount only; real names go in `terms` instead,
  // matching what ModernRewardCard/RewardDetailView actually show.
  const off = state.getPercent === 100 ? 'free' : `${state.getPercent ?? 0}% off`;
  const title = `Buy ${state.buyQuantity ?? 1}, get ${state.getQuantity ?? 1} ${off}`;

  // 'or' here, not the default 'and' — buys/gets are eligibility pools
  // ("any qualifying item from this set"), not a bundle you get all of.
  const buysList = formatItemList(selectionTitles(state.buysSelection), 4, 'or');
  const getsList = formatItemList(selectionTitles(state.getsSelection), 4, 'or');

  const terms =
    `Buy ${itemsLabel(state.buysSelection)}: ${buysList || '(choose an item)'}. \n` +
    `Get ${itemsLabel(state.getsSelection)}: ${getsList || '(choose an item)'}.` +
    (state.combinesWithOtherDiscounts ? '\nMay combine with some other store discounts.' : '\nCannot be combined with other discounts.');
  return { title, terms };
}

export function discountMutationInfo(state: DiscountFormState): { mutation: string; note: string } {
  return state.discountKind === 'amount'
    ? { mutation: 'discountCodeBasicCreate', note: 'Scope maps to items.products / items.collections.' }
    : { mutation: 'discountCodeBxgyCreate', note: 'customerBuys.quantity + customerGets.value.' };
}