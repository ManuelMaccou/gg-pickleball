// Destination: lib/shopify/buildDiscountItemsInput.ts

interface StoredItemSelection {
  all?: boolean;
  products?: { productId: string }[];
  collections?: { collectionId: string }[];
}

// Converts our stored scope shape into Shopify's DiscountItemsInput.
// products and collections CAN be set together — confirmed against current
// Shopify docs, this is not a oneOf. BXGY's buys/gets should never carry
// { all: true } in practice (there's no "all" option on that side of a
// BXGY discount at all), but this function doesn't special-case that check
// itself — it just reflects whatever shape it's given, since that
// validation already happens upstream in the admin form.
export function buildDiscountItemsInput(sel: StoredItemSelection): Record<string, unknown> {
  if (sel.all) return { all: true };

  const input: Record<string, unknown> = {};
  if (sel.products?.length) {
    input.products = { productsToAdd: sel.products.map((p) => p.productId) };
  }
  if (sel.collections?.length) {
    input.collections = { add: sel.collections.map((c) => c.collectionId) };
  }
  return input;
}

// Maps the single "combines with other discounts" toggle in the admin UI
// onto Shopify's three-class combinesWith input. The UI only exposes one
// switch, not per-class control, so all three classes move together.
export function buildCombinesWithInput(combinesWithOtherDiscounts: boolean) {
  return {
    orderDiscounts: combinesWithOtherDiscounts,
    productDiscounts: combinesWithOtherDiscounts,
    shippingDiscounts: combinesWithOtherDiscounts,
  };
}