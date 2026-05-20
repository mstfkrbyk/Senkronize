import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import { Clock, Package, ShoppingCart, Store } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type {
  GlobalSearchHit,
  GlobalSearchResults,
  GlobalSearchResultType,
} from '@/types/search';

const HISTORY_KEY = 'senkronize-search-history';
const FREQUENT_KEY = 'senkronize-search-frequent';
const MAX_HISTORY = 10;
const MAX_FREQUENT = 8;

export const GLOBAL_SEARCH_EVENT = 'senkronize-open-global-search';

export function openGlobalSearch(): void {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_EVENT));
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveHistory(queries: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(queries.slice(0, MAX_HISTORY)));
}

function loadFrequent(): GlobalSearchHit[] {
  try {
    const raw = localStorage.getItem(FREQUENT_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GlobalSearchHit[]) : [];
  } catch {
    return [];
  }
}

function saveFrequent(hits: GlobalSearchHit[]): void {
  localStorage.setItem(FREQUENT_KEY, JSON.stringify(hits.slice(0, MAX_FREQUENT)));
}

function recordFrequentHit(hit: GlobalSearchHit): void {
  const current = loadFrequent();
  const key = `${hit.type}:${hit.id}`;
  const filtered = current.filter((h) => `${h.type}:${h.id}` !== key);
  saveFrequent([hit, ...filtered]);
}

function formatMoney(value: unknown): string {
  const n =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺`;
}

function platformLabel(platform: string): string {
  return getMarketplaceBranding(platform).label;
}

function buildHits(data: GlobalSearchResults): GlobalSearchHit[] {
  const products = data.products.map(
    (p): GlobalSearchHit => ({
      type: 'product',
      id: p.id,
      label: p.name,
      subtitle: [p.barcode, p.sku].filter(Boolean).join(' · '),
      href: `/products/${p.id}`,
    }),
  );
  const orders = data.orders.map(
    (o): GlobalSearchHit => ({
      type: 'order',
      id: o.id,
      label: o.platformOrderId,
      subtitle: `${o.customerName} · ${formatMoney(o.totalAmount)} · ${platformLabel(o.platform)}`,
      href: `/orders?search=${encodeURIComponent(o.platformOrderId)}`,
    }),
  );
  const listings = data.listings.map(
    (l): GlobalSearchHit => ({
      type: 'listing',
      id: l.id,
      label: l.title,
      subtitle: `${l.barcode} · ${platformLabel(l.platform)}`,
      href: `/listings?search=${encodeURIComponent(l.barcode)}`,
    }),
  );
  return [...products, ...orders, ...listings];
}

function hitIcon(type: GlobalSearchResultType): ReactElement {
  if (type === 'product') {
    return <Package className="size-4" aria-hidden />;
  }
  if (type === 'order') {
    return <ShoppingCart className="size-4" aria-hidden />;
  }
  return <Store className="size-4" aria-hidden />;
}

export function GlobalSearch(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [frequent, setFrequent] = useState<GlobalSearchHit[]>(() => loadFrequent());
  const debouncedQuery = useDebouncedValue(query, 300);
  const searchTrim = debouncedQuery.trim();
  const canSearch = searchTrim.length >= 2;

  const searchQuery = useQuery({
    queryKey: ['global-search', searchTrim],
    queryFn: async (): Promise<GlobalSearchResults> => {
      const { data } = await api.get<{ data: GlobalSearchResults }>('/search', {
        params: { q: searchTrim, limit: 10 },
      });
      return data.data;
    },
    enabled: open && canSearch,
    staleTime: 30_000,
  });

  const hits = useMemo(
    () => (searchQuery.data ? buildHits(searchQuery.data) : []),
    [searchQuery.data],
  );

  const productHits = hits.filter((h) => h.type === 'product');
  const orderHits = hits.filter((h) => h.type === 'order');
  const listingHits = hits.filter((h) => h.type === 'listing');

  const pushHistory = useCallback((q: string): void => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      return;
    }
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const navigateToHit = useCallback(
    (hit: GlobalSearchHit): void => {
      recordFrequentHit(hit);
      setFrequent(loadFrequent());
      if (canSearch) {
        pushHistory(searchTrim);
      }
      setOpen(false);
      navigate(hit.href);
    },
    [canSearch, navigate, pushHistory, searchTrim],
  );

  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true);
    };
    window.addEventListener(GLOBAL_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener(GLOBAL_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={t('common.searchPlaceholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!canSearch && history.length > 0 ? (
          <CommandGroup heading="Son aramalar">
            {history.map((item) => (
              <CommandItem
                key={item}
                value={`history-${item}`}
                onSelect={() => {
                  setQuery(item);
                }}
              >
                <Clock className="size-4" aria-hidden />
                <span>{item}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {!canSearch && frequent.length > 0 ? (
          <>
            {history.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading="Sık kullanılanlar">
              {frequent.map((hit) => (
                <CommandItem
                  key={`${hit.type}-${hit.id}`}
                  value={`freq-${hit.type}-${hit.id}`}
                  onSelect={() => {
                    navigateToHit(hit);
                  }}
                >
                  {hitIcon(hit.type)}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{hit.label}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {hit.subtitle}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {canSearch && searchQuery.isFetching ? (
          <CommandEmpty>Aranıyor…</CommandEmpty>
        ) : null}

        {canSearch && searchQuery.isError ? (
          <CommandEmpty>Arama başarısız oldu.</CommandEmpty>
        ) : null}

        {canSearch && !searchQuery.isFetching && hits.length === 0 ? (
          <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        ) : null}

        {canSearch && productHits.length > 0 ? (
          <CommandGroup heading="Ürünler">
            {productHits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`product-${hit.id}`}
                onSelect={() => {
                  navigateToHit(hit);
                }}
              >
                {hitIcon(hit.type)}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{hit.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {hit.subtitle}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {canSearch && orderHits.length > 0 ? (
          <CommandGroup heading="Siparişler">
            {orderHits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`order-${hit.id}`}
                onSelect={() => {
                  navigateToHit(hit);
                }}
              >
                {hitIcon(hit.type)}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{hit.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {hit.subtitle}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {canSearch && listingHits.length > 0 ? (
          <CommandGroup heading="Listelemeler">
            {listingHits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`listing-${hit.id}`}
                onSelect={() => {
                  navigateToHit(hit);
                }}
              >
                {hitIcon(hit.type)}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{hit.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {hit.subtitle}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {!canSearch && history.length === 0 && frequent.length === 0 ? (
          <CommandEmpty>
            Ürün, sipariş veya listeleme arayın. Cmd+K veya / ile açılır.
          </CommandEmpty>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
