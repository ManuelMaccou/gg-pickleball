// lib/shopify/urls.ts
//
// Shared URL builders for Shopify admin links.

export function buildShopifyPricingUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace('.myshopify.com', '');
  const appHandle = process.env.NEXT_PUBLIC_SHOPIFY_APP_HANDLE ?? 'gg-pickleball-3';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}