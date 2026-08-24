'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogCollectionItem, CatalogProductItem } from '@/lib/rewards/discountTargetSelection';

type CatalogTab = 'products' | 'collections';

interface UseShopifyCatalogOptions {
  clientId: string;
  // Only fetch while the modal that owns this hook is actually open —
  // avoids hitting Shopify on every render of a hidden dialog.
  enabled: boolean;
  initialTab?: CatalogTab;
  // When set, the hook's tab is locked to this value and re-synced every
  // time it changes — not just read once on mount. Used by the single-
  // type scope pickers (amount-off "Applies to: Specific products" or
  // "Collections"), which have no in-modal tab switcher for the user to
  // fix this themselves. Omit for the BXGY buys/gets pickers (tabs="both"),
  // which do let the user toggle between tabs inside the modal.
  forcedTab?: CatalogTab;
}

export function useShopifyCatalog({ clientId, enabled, initialTab = 'products', forcedTab }: UseShopifyCatalogOptions) {
  const [tab, setTab] = useState<CatalogTab>(forcedTab ?? initialTab);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProductItem[]>([]);
  const [collections, setCollections] = useState<CatalogCollectionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The actual fix: previously forcedTab/initialTab only ever seeded the
  // state on mount. Since this hook's owning component isn't remounted
  // when the parent's scope changes (products <-> collections), nothing
  // told it the forced type had changed — it just kept fetching and
  // rendering whatever type it started with. This re-syncs on every
  // change, which also naturally re-triggers the fetch effect below since
  // `tab` is a real dependency of it.
  useEffect(() => {
    if (forcedTab && forcedTab !== tab) {
      setTab(forcedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedTab]);

  // Guards against a slow response for a stale tab/query clobbering a
  // faster, newer one — bumped on every new fetch, checked on return.
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (opts: { reset: boolean }, activeCursor: string | null) => {
      if (!enabled || !clientId) return;
      const thisRequestId = ++requestId.current;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ clientId, type: tab, first: '20' });
        if (query.trim()) params.set('query', query.trim());
        if (!opts.reset && activeCursor) params.set('cursor', activeCursor);

        const res = await fetch(`/api/shopify/catalog?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load catalog');

        if (thisRequestId !== requestId.current) return; // superseded

        if (tab === 'products') {
          setProducts((prev) => (opts.reset ? data.items : [...prev, ...data.items]));
        } else {
          setCollections((prev) => (opts.reset ? data.items : [...prev, ...data.items]));
        }
        setHasNextPage(data.pageInfo?.hasNextPage ?? false);
        setCursor(data.pageInfo?.endCursor ?? null);
      } catch (err) {
        if (thisRequestId !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      } finally {
        if (thisRequestId === requestId.current) setLoading(false);
      }
    },
    [enabled, clientId, tab, query]
  );

  // Reset + refetch whenever the modal opens, the tab changes, or the
  // search settles (debounced). Never appends here — only loadMore appends.
  useEffect(() => {
    if (!enabled) return;
    const delay = query ? 300 : 0;
    const handle = setTimeout(() => {
      setCursor(null);
      fetchPage({ reset: true }, null);
    }, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tab, query]);

  const loadMore = useCallback(() => {
    if (!loading && hasNextPage) fetchPage({ reset: false }, cursor);
  }, [loading, hasNextPage, fetchPage, cursor]);

  return {
    tab,
    setTab,
    query,
    setQuery,
    items: tab === 'products' ? products : collections,
    hasNextPage,
    loading,
    error,
    loadMore,
  };
}