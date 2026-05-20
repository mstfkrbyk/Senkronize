import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Clock,
  FileDown,
  LayoutDashboard,
  Link2,
  Package,
  Plug,
  RefreshCw,
  ShoppingCart,
  Store,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useMarketplaceConnections, useTriggerManualSync } from '@/hooks/useConnections';
import { api } from '@/lib/api';
import { COMMAND_PALETTE_EVENT } from '@/lib/command-palette';
import { fuzzyScore } from '@/lib/fuzzy-match';
import { modKeyLabel } from '@/lib/platform';
import { getRecentViews, recordRecentView } from '@/lib/recent-views';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type {
  GlobalSearchHit,
  GlobalSearchResults,
  GlobalSearchResultType,
} from '@/types/search';

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  category: 'navigation' | 'action' | 'recent' | 'search';
  action: () => void;
  keywords?: string[];
}

const CATEGORY_HEADINGS: Record<Command['category'], string> = {
  navigation: 'Navigasyon',
  action: 'Eylemler',
  recent: 'Son Görüntülenenler',
  search: 'Arama Sonuçları',
};

const HISTORY_GROUP = 'Son Aramalar';

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

function hitIcon(type: GlobalSearchResultType): LucideIcon {
  if (type === 'product') {
    return Package;
  }
  if (type === 'order') {
    return ShoppingCart;
  }
  return Store;
}

function commandSearchText(cmd: Command): string {
  return [cmd.title, cmd.subtitle ?? '', ...(cmd.keywords ?? [])].join(' ');
}

function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (!q) {
    return commands;
  }
  return commands
    .map((cmd) => ({ cmd, score: fuzzyScore(q, commandSearchText(cmd)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd);
}

function useStaticCommands(
  navigate: ReturnType<typeof useNavigate>,
  onClose: () => void,
  triggerSync: ReturnType<typeof useTriggerManualSync>,
  connections: { id: string; isActive: boolean }[],
): Command[] {
  const wrap =
    (fn: () => void) =>
    (): void => {
      onClose();
      fn();
    };

  const firstActive = connections.find((c) => c.isActive);

  return useMemo(
    () => [
      {
        id: 'nav-dashboard',
        title: 'Gösterge Paneline Git',
        icon: LayoutDashboard,
        category: 'navigation' as const,
        keywords: ['dashboard', 'ana', 'panel'],
        action: wrap(() => navigate('/dashboard')),
      },
      {
        id: 'nav-orders',
        title: 'Siparişlere Git',
        icon: ShoppingCart,
        category: 'navigation' as const,
        keywords: ['sipariş', 'order'],
        action: wrap(() => navigate('/orders')),
      },
      {
        id: 'nav-products',
        title: 'Ürünlere Git',
        icon: Package,
        category: 'navigation' as const,
        keywords: ['ürün', 'katalog', 'product'],
        action: wrap(() => navigate('/products')),
      },
      {
        id: 'nav-stock',
        title: 'Stoka Git',
        icon: Warehouse,
        category: 'navigation' as const,
        keywords: ['stok', 'depo', 'stock'],
        action: wrap(() => navigate('/stock')),
      },
      {
        id: 'nav-reports',
        title: 'Raporlara Git',
        icon: BarChart2,
        category: 'navigation' as const,
        keywords: ['rapor', 'report', 'analiz'],
        action: wrap(() => navigate('/reports')),
      },
      {
        id: 'nav-connections',
        title: 'Bağlantılara Git',
        icon: Plug,
        category: 'navigation' as const,
        keywords: ['entegrasyon', 'bağlantı', 'connection'],
        action: wrap(() => navigate('/connections')),
      },
      {
        id: 'nav-listings',
        title: 'İlanlara Git',
        icon: Store,
        category: 'navigation' as const,
        keywords: ['listing', 'ilan', 'pazaryeri'],
        action: wrap(() => navigate('/listings')),
      },
      {
        id: 'action-new-connection',
        title: 'Yeni Bağlantı Ekle',
        icon: Link2,
        category: 'action' as const,
        keywords: ['bağlantı', 'ekle', 'entegrasyon'],
        action: wrap(() => navigate('/connections')),
      },
      {
        id: 'action-sync',
        title: 'Şimdi Sync Et',
        icon: RefreshCw,
        category: 'action' as const,
        keywords: ['senkron', 'sync', 'güncelle'],
        action: wrap(() => {
          if (!firstActive) {
            toast.error('Aktif bağlantı bulunamadı.');
            navigate('/connections');
            return;
          }
          triggerSync.mutate(firstActive.id, {
            onSuccess: () => toast.success('Senkronizasyon kuyruğa alındı.'),
            onError: () => toast.error('Senkronizasyon başlatılamadı.'),
          });
        }),
      },
      {
        id: 'action-pdf-report',
        title: 'PDF Rapor İndir',
        icon: FileDown,
        category: 'action' as const,
        keywords: ['pdf', 'rapor', 'indir', 'export'],
        action: wrap(() => navigate('/reports')),
      },
    ],
    [navigate, onClose, triggerSync, firstActive, connections],
  );
}

export function CommandPalette(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const searchTrim = debouncedQuery.trim();
  const canSearch = searchTrim.length >= 2;

  const { terms, clicked, addTerm, addClicked } = useSearchHistory();
  const { data: connections = [] } = useMarketplaceConnections();
  const triggerSync = useTriggerManualSync();

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

  const close = useCallback((): void => {
    setOpen(false);
  }, []);

  const staticCommands = useStaticCommands(
    navigate,
    close,
    triggerSync,
    connections.map((c) => ({ id: c.id, isActive: c.isActive })),
  );

  const navigateToHit = useCallback(
    (hit: GlobalSearchHit): void => {
      if (canSearch) {
        addTerm(searchTrim);
      }
      addClicked(hit);
      if (hit.type === 'product') {
        recordRecentView({
          type: 'product',
          id: hit.id,
          label: hit.label,
          href: hit.href,
        });
      } else if (hit.type === 'order') {
        recordRecentView({
          type: 'order',
          id: hit.id,
          label: hit.label,
          href: hit.href,
        });
      }
      close();
      navigate(hit.href);
    },
    [addClicked, addTerm, canSearch, close, navigate, searchTrim],
  );

  const apiSearchCommands = useMemo((): Command[] => {
    if (!searchQuery.data) {
      return [];
    }
    return buildHits(searchQuery.data).map((hit) => ({
      id: `search-${hit.type}-${hit.id}`,
      title: hit.label,
      subtitle: hit.subtitle,
      icon: hitIcon(hit.type),
      category: 'search' as const,
      keywords: [hit.type, hit.subtitle],
      action: () => navigateToHit(hit),
    }));
  }, [navigateToHit, searchQuery.data]);

  const recentCommands = useMemo((): Command[] => {
    return getRecentViews().map((view) => ({
      id: `recent-${view.type}-${view.id}`,
      title: view.label,
      subtitle: view.type === 'order' ? 'Sipariş' : 'Ürün',
      icon: view.type === 'order' ? ShoppingCart : Package,
      category: 'recent' as const,
      action: () => {
        close();
        navigate(view.href);
      },
    }));
  }, [close, navigate]);

  const historyCommands = useMemo((): Command[] => {
    return terms.map((term) => ({
      id: `history-${term}`,
      title: term,
      icon: Clock,
      category: 'recent' as const,
      keywords: [term],
      action: () => setQuery(term),
    }));
  }, [terms]);

  const clickedCommands = useMemo((): Command[] => {
    return clicked.map(({ hit }) => ({
      id: `clicked-${hit.type}-${hit.id}`,
      title: hit.label,
      subtitle: hit.subtitle,
      icon: hitIcon(hit.type),
      category: 'recent' as const,
      action: () => navigateToHit(hit),
    }));
  }, [clicked, navigateToHit]);

  const allCommands = useMemo(() => {
    const base = [...staticCommands, ...recentCommands, ...clickedCommands];
    if (canSearch) {
      return [...base, ...historyCommands, ...apiSearchCommands];
    }
    return base;
  }, [
    apiSearchCommands,
    canSearch,
    clickedCommands,
    historyCommands,
    recentCommands,
    staticCommands,
  ]);

  const filtered = useMemo(
    () => filterCommands(allCommands, query),
    [allCommands, query],
  );

  const grouped = useMemo(() => {
    const groups: Partial<Record<Command['category'], Command[]>> = {};
    for (const cmd of filtered) {
      const list = groups[cmd.category] ?? [];
      list.push(cmd);
      groups[cmd.category] = list;
    }
    return groups;
  }, [filtered]);

  const historyOnly = useMemo(
    () => filterCommands(historyCommands, query),
    [historyCommands, query],
  );

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const showEmpty =
    filtered.length === 0 &&
    !searchQuery.isFetching &&
    (canSearch || query.trim().length > 0);

  const renderGroup = (category: Command['category'], cmds: Command[]): ReactElement | null => {
    if (cmds.length === 0) {
      return null;
    }
    return (
      <CommandGroup key={category} heading={CATEGORY_HEADINGS[category]}>
        {cmds.map((cmd) => (
          <CommandItem
            key={cmd.id}
            value={cmd.id}
            onSelect={() => cmd.action()}
          >
            <cmd.icon className="size-4" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{cmd.title}</span>
              {cmd.subtitle ? (
                <span className="text-muted-foreground truncate text-xs">
                  {cmd.subtitle}
                </span>
              ) : null}
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t('common.searchPlaceholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {showEmpty ? <CommandEmpty>Sonuç bulunamadı.</CommandEmpty> : null}

          {canSearch && searchQuery.isFetching ? (
            <CommandEmpty>Aranıyor…</CommandEmpty>
          ) : null}

          {canSearch && searchQuery.isError ? (
            <CommandEmpty>Arama başarısız oldu.</CommandEmpty>
          ) : null}

          {!canSearch && historyOnly.length > 0 ? (
            <CommandGroup heading={HISTORY_GROUP}>
              {historyOnly.map((cmd) => (
                <CommandItem key={cmd.id} value={cmd.id} onSelect={() => cmd.action()}>
                  <Clock className="size-4" aria-hidden />
                  <span>{cmd.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!canSearch && historyOnly.length > 0 && filtered.length > 0 ? (
            <CommandSeparator />
          ) : null}

          {renderGroup('navigation', grouped.navigation ?? [])}
          {(grouped.navigation?.length ?? 0) > 0 &&
          (grouped.action?.length ?? 0) > 0 ? (
            <CommandSeparator />
          ) : null}
          {renderGroup('action', grouped.action ?? [])}
          {(grouped.recent?.length ?? 0) > 0 &&
          ((grouped.navigation?.length ?? 0) > 0 || (grouped.action?.length ?? 0) > 0) ? (
            <CommandSeparator />
          ) : null}
          {renderGroup('recent', grouped.recent ?? [])}
          {(grouped.search?.length ?? 0) > 0 ? <CommandSeparator /> : null}
          {renderGroup('search', grouped.search ?? [])}

          {!canSearch &&
          filtered.length === 0 &&
          !searchQuery.isFetching ? (
            <CommandEmpty>
              Komut veya kayıt arayın. {modKeyLabel()}+K ile açılır.
            </CommandEmpty>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export { COMMAND_PALETTE_EVENT } from '@/lib/command-palette';
export { openCommandPalette, openGlobalSearch, GLOBAL_SEARCH_EVENT } from '@/lib/command-palette';
