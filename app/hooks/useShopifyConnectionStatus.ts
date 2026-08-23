// Destination: lib/hooks/useShopifyConnectionStatus.ts
'use client';

import { useEffect, useState } from 'react';
import { IClient } from '@/app/types/databaseTypes';

export type ShopifyStatus = 'checking' | 'connected' | 'disconnected' | 'check_failed';

// Brand admin pages fetch `location` from /api/admin, which strips
// accessToken for security — so location.shopify.accessToken is NEVER
// present from that fetch alone, regardless of whether Shopify is
// actually connected right now. shopDomain alone isn't a safe substitute
// either: app/uninstalled deliberately keeps shopDomain/shopId/envKey on
// the client record even after a real disconnect, so a client can look
// "configured" in the DB long after the connection is dead.
//
// This hook does the live verification (/api/brand/shopify-status) and
// only THEN patches a sentinel accessToken value onto the caller's
// location state — same mechanism the dashboard page already had, now
// shared so every brand admin page gets an accurate status instead of
// each page needing to remember to copy this logic itself.
export function useShopifyConnectionStatus(
  location: IClient | null,
  setLocation: React.Dispatch<React.SetStateAction<IClient | null>>
) {
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus>('checking');
  const [shopifyStatusReason, setShopifyStatusReason] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;

    // Only tells us Shopify was EVER configured — not that it's still
    // valid. See the file-level comment above for why shopDomain alone
    // isn't sufficient.
    const isShopifyConnectedInDB = !!(
      location.retailSoftware === 'shopify' &&
      location.shopify?.shopDomain
    );

    if (!isShopifyConnectedInDB) {
      setShopifyStatus('disconnected');
      return;
    }

    const checkConnection = async () => {
      try {
        const res = await fetch('/api/brand/shopify-status', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          setShopifyStatus('check_failed');
          return;
        }
        if (data.connected) {
          setShopifyStatus('connected');
          setLocation((prev) =>
            prev
              ? ({
                  ...prev,
                  shopify: {
                    ...prev.shopify,
                    hasActivePlan: data.hasActivePlan ?? prev.shopify?.hasActivePlan,
                    // accessToken is stripped from /api/admin for security.
                    // This sentinel lets truthy checks (isShopifyConnected
                    // in BrandSidebar, etc.) work without the real token
                    // ever reaching the client — and it only gets set here,
                    // after the live check above actually confirms the
                    // connection, not just because a DB field exists.
                    accessToken: prev.shopify?.accessToken || 'connected',
                  },
                } as unknown as IClient)
              : null
          );
        } else {
          setShopifyStatus('disconnected');
          setShopifyStatusReason(data.reason ?? null);
          setLocation((prev) =>
            prev
              ? ({ ...prev, shopify: { ...prev.shopify, accessToken: undefined } } as unknown as IClient)
              : null
          );
        }
      } catch {
        setShopifyStatus('check_failed');
      }
    };
    checkConnection();
  }, [location?._id]);

  return { shopifyStatus, shopifyStatusReason };
}