// lib/shopify/appMode.ts
//
// Single source of truth for the current Shopify app deployment mode.
//
// SHOPIFY_APP_MODE=custom  → early-access custom app installs, Stripe billing,
//                            webhooks registered via GraphQL in the OAuth callback
// SHOPIFY_APP_MODE=public  → public App Store listing, Shopify App Pricing,
//                            webhooks managed by shopify.app.toml (default)
//
// TO REVERT TO PUBLIC APP:
//   1. Set SHOPIFY_APP_MODE=public (or remove the env var entirely)
//   All Stripe billing paths, GraphQL webhook registration, and the
//   /admin/brand/billing/payment-method page become dormant automatically.
//   No code deletion required.

export function isCustomAppMode(): boolean {
  return process.env.SHOPIFY_APP_MODE === 'custom';
}