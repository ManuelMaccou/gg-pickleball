// Destination: lib/rewards/discountTargetSelection.ts

export interface CatalogProductItem {
  productId: string;
  title: string;
  price?: string;
  variantCount?: number;
}

export interface CatalogCollectionItem {
  collectionId: string;
  title: string;
  productCount?: number;
}

// Mirrors DiscountItemSelection minus `all` — a picker target is always
// either "entire store" (handled one level up, never rendered by this
// picker) or a set of products/collections chosen here.
export interface TargetSelection {
  products: { productId: string; title: string }[];
  collections: { collectionId: string; title: string }[];
}

export const EMPTY_SELECTION: TargetSelection = { products: [], collections: [] };

export function isProductSelected(sel: TargetSelection, productId: string): boolean {
  return sel.products.some((p) => p.productId === productId);
}

export function isCollectionSelected(sel: TargetSelection, collectionId: string): boolean {
  return sel.collections.some((c) => c.collectionId === collectionId);
}

// A single target (an amount-off scope, or one side of a BXGY buy/get)
// can be products-only or collections-only, never both — a product
// decision, not a Shopify API limit (the API does allow mixing). Adding
// an item of one type here clears the other type entirely. Deselecting
// doesn't need to touch the other type, since the invariant already holds
// by the time you're removing something.
export function toggleProduct(sel: TargetSelection, item: CatalogProductItem): TargetSelection {
  const exists = isProductSelected(sel, item.productId);
  if (exists) {
    return { ...sel, products: sel.products.filter((p) => p.productId !== item.productId) };
  }
  return {
    products: [...sel.products, { productId: item.productId, title: item.title }],
    collections: [],
  };
}

export function toggleCollection(sel: TargetSelection, item: CatalogCollectionItem): TargetSelection {
  const exists = isCollectionSelected(sel, item.collectionId);
  if (exists) {
    return { ...sel, collections: sel.collections.filter((c) => c.collectionId !== item.collectionId) };
  }
  return {
    products: [],
    collections: [...sel.collections, { collectionId: item.collectionId, title: item.title }],
  };
}

// Admin-facing only — the picker's own "N products · M collections
// selected" counter at the bottom of the browse modal. This is precise
// inventory-style copy on purpose, for someone actively building the
// discount. Do NOT reuse this for anything a player sees; see
// targetSummaryText in discountFormState.ts for that.
export function selectionCountLabel(sel: TargetSelection): string {
  const parts: string[] = [];
  if (sel.products.length) parts.push(`${sel.products.length} product${sel.products.length === 1 ? '' : 's'}`);
  if (sel.collections.length) parts.push(`${sel.collections.length} collection${sel.collections.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'Nothing selected yet';
}

export function selectionIsEmpty(sel: TargetSelection): boolean {
  return sel.products.length === 0 && sel.collections.length === 0;
}

// Should never actually happen through the real UI — toggleProduct/
// toggleCollection above enforce this at the source. Exists as a backstop
// for validateDiscountForm in case something else ever writes to these
// fields directly (legacy data, an import script, a future admin tool).
export function selectionIsMixed(sel: TargetSelection): boolean {
  return sel.products.length > 0 && sel.collections.length > 0;
}

// Player-facing list formatter — "Paddles", "Paddles and Apparel",
// "Paddles, Apparel, and Socks", or "Paddles, Apparel, Socks, and 3 more"
// past maxShown. Used in the reward detail view to enumerate the actual
// products/collections a scoped discount applies to, since the reward's
// title/summary intentionally stays generic ("select items") once there's
// more than one — see targetSummaryText in discountFormState.ts.
// connector defaults to 'and' — correct for "Applies to: A, B, and C"
// (the discount covers all of them). Pass 'or' for BXGY buy/get lists,
// which are eligibility POOLS, not bundles — Shopify's customerBuys/
// customerGets items mean "any qualifying item from this set," which in
// English is "or," not "and."
export function formatItemList(titles: string[], maxShown = 4, connector: 'and' | 'or' = 'and'): string {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0];

  if (titles.length <= maxShown) {
    if (titles.length === 2) return `${titles[0]} ${connector} ${titles[1]}`;
    return `${titles.slice(0, -1).join(', ')}, ${connector} ${titles[titles.length - 1]}`;
  }

  const shown = titles.slice(0, maxShown);
  const remaining = titles.length - maxShown;
  return `${shown.join(', ')}, ${connector} ${remaining} more`;
}

// Picks the right word for a selection: "product" when it's only
// products, "from collection" when it's only collections, or the generic
// "item" for a mixed selection (or an empty one) — there's no single
// grammatically correct word for a mix, since Shopify allows combining
// products and collections within one target. Shared across the admin
// preview, the reward detail view, and the reward card specifically so
// this can't drift between them the way the and/or connector above did —
// loosely typed so it accepts both live form state (TargetSelection) and
// a persisted reward's stored scope.
export function itemsLabel(sel: { products?: unknown[]; collections?: unknown[] }): string {
  const hasProducts = (sel.products?.length ?? 0) > 0;
  const hasCollections = (sel.collections?.length ?? 0) > 0;
  if (hasCollections && !hasProducts) return 'from collection';
  if (hasProducts && !hasCollections) return 'product';
  return 'item';
}

// Flattens a selection's products+collections into a flat list of titles,
// for use with formatItemList when the actual specific names are wanted
// rather than a count or a single name — e.g. BXGY (which never names
// items in its title, regardless of count) or any player-facing "what
// does this actually cover" display. Loosely typed on purpose so it
// accepts both live form state (TargetSelection) and a persisted reward's
// stored scope (DiscountItemSelection) — same shape, different source.
export function selectionTitles(sel: { products?: { title: string }[]; collections?: { title: string }[] }): string[] {
  return [...(sel.products ?? []).map((p) => p.title), ...(sel.collections ?? []).map((c) => c.title)];
}