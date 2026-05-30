import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { BulkPriceUpdateModal } from '@/components/listings/BulkPriceUpdateModal';
import { DataTablePagination } from '@/components/DataTablePagination';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TablePageEmptyState } from '@/components/TablePageEmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveNav } from '@/hooks/useActiveNav';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useListingSyncProgressListener } from '@/hooks/useListingSyncProgress';
import { useHasMarketplacePlatforms } from '@/hooks/useHasMarketplacePlatforms';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useSocket } from '@/hooks/useSocket';
import { useListingsPageStore } from '@/store/tablePages.store';
import type {
  Listing,
  ListingFilters,
  ListingSort,
  ListingStatus,
} from '@/types/listing';

import {
  useBulkListingDelete,
  useBulkListingStatus,
  useBulkListingStock,
  useBulkListingSync,
  useBuyBoxSnapshotMap,
  useListings,
  useSyncListing,
  useSyncListings,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';
import { ListingFilters as ListingFiltersPanel } from './ListingFilters';
import { ListingsKpiRow } from './ListingsKpiRow';
import { ListingsTable } from './ListingsTable';

const PAGE_SIZE_DEFAULT = 20;

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'updated_desc', label: 'Son güncelleme' },
  { value: 'price_asc', label: 'Fiyat (artan)' },
  { value: 'price_desc', label: 'Fiyat (azalan)' },
  { value: 'stock_asc', label: 'Stok (artan)' },
  { value: 'stock_desc', label: 'Stok (azalan)' },
];

function listingKey(listing: Listing): string {
  return `${listing.barcode}:${listing.platform}`;
}

function matchesBuyBoxFilter(
  listing: Listing,
  filter: ListingFilters['buyBoxStatus'],
  buyBoxMap: Map<string, { isWinner: boolean; buyBoxPrice: number }>,
): boolean {
  if (!filter || filter === 'ALL') {
    return true;
  }
  const snap = buyBoxMap.get(listingKey(listing));
  if (!snap) {
    return false;
  }
  if (filter === 'WINNING') {
    return snap.isWinner;
  }
  return !snap.isWinner;
}

export function ListingsPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.listings'));

  usePageTitle('Listelemeler');
  useListingSyncProgressListener();

  const queryClient = useQueryClient();
  const { on } = useSocket();
  const [searchParams] = useSearchParams();
  const showBuyBox = useHasMarketplacePlatforms();

  const [filters, setFilters] = useState<ListingFilters>({
    page: 1,
    limit: PAGE_SIZE_DEFAULT,
    sort: 'updated_desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkStockOpen, setBulkStockOpen] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [stockSavingId, setStockSavingId] = useState<string | null>(null);

  const selectedListingIds = useListingsPageStore((s) => s.selectedListingIds);
  const toggleListingRow = useListingsPageStore((s) => s.toggleListingRow);
  const toggleAllOnPage = useListingsPageStore((s) => s.toggleAllOnPage);
  const clearListingSelection = useListingsPageStore((s) => s.clearListingSelection);
  const setSelectedListingIds = useListingsPageStore((s) => s.setSelectedListingIds);

  const connectionsQuery = useMarketplaceConnections();
  const buyBoxMapQuery = useBuyBoxSnapshotMap(showBuyBox);
  const syncListingsMutation = useSyncListings();
  const syncOneMutation = useSyncListing();
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();
  const bulkStatusMutation = useBulkListingStatus();
  const bulkStockMutation = useBulkListingStock();
  const bulkSyncMutation = useBulkListingSync();
  const bulkDeleteMutation = useBulkListingDelete();

  const activePlatforms = useMemo(() => {
    const conns = connectionsQuery.data ?? [];
    return conns.filter((c) => c.isActive).map((c) => c.platform);
  }, [connectionsQuery.data]);

  const listingQueryFilters = useMemo((): ListingFilters => {
    const next: ListingFilters = {
      ...filters,
      search: debouncedSearch.trim() || undefined,
    };
    if (next.buyBoxStatus) {
      delete next.buyBoxStatus;
    }
    return next;
  }, [filters, debouncedSearch]);

  const listingsQuery = useListings(listingQueryFilters);
  const buyBoxMap = useMemo(
    () => buyBoxMapQuery.data ?? new Map(),
    [buyBoxMapQuery.data],
  );

  const buyBoxPriceByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, val] of buyBoxMap.entries()) {
      map.set(key, val.buyBoxPrice);
    }
    return map;
  }, [buyBoxMap]);

  useEffect(() => {
    const platform = searchParams.get('platform')?.trim();
    if (!platform) {
      return;
    }
    setFilters((prev) =>
      prev.platform === platform ? prev : { ...prev, platform, page: 1 },
    );
  }, [searchParams]);

  useEffect(() => {
    clearListingSelection();
  }, [clearListingSelection, listingQueryFilters]);

  useEffect(() => {
    const unlisten = on('listing:synced', () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success('Listelemeler güncellendi');
    });
    return unlisten;
  }, [on, queryClient]);

  const rawData = listingsQuery.data;
  const filteredItems = useMemo(() => {
    const items = rawData?.items ?? [];
    if (!filters.buyBoxStatus || filters.buyBoxStatus === 'ALL') {
      return items;
    }
    return items.filter((l) =>
      matchesBuyBoxFilter(l, filters.buyBoxStatus, buyBoxMap),
    );
  }, [rawData?.items, filters.buyBoxStatus, buyBoxMap]);

  const total = rawData?.total ?? 0;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? PAGE_SIZE_DEFAULT;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const selectedIdSet = useMemo(
    () => new Set(selectedListingIds),
    [selectedListingIds],
  );

  const selectedRowsOnPage =
    filteredItems.filter((l) => selectedIdSet.has(l.id));

  const allSelectedListings = useMemo(() => {
    const byId = new Map((rawData?.items ?? []).map((l) => [l.id, l]));
    return selectedListingIds
      .map((id) => byId.get(id))
      .filter((l): l is Listing => l != null);
  }, [rawData?.items, selectedListingIds]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      filters.platforms?.trim() ||
      filters.platform ||
      filters.status ||
      filters.stockMin != null ||
      filters.stockMax != null ||
      filters.minSalePrice != null ||
      filters.maxSalePrice != null ||
      filters.priceMin != null ||
      filters.priceMax != null ||
      filters.lastSyncAtSince?.trim() ||
      filters.lastSyncAtUntil?.trim() ||
      filters.category?.trim() ||
      (filters.buyBoxStatus && filters.buyBoxStatus !== 'ALL'),
  );

  const hasMarketplaceConnections =
    connectionsQuery.data === undefined
      ? null
      : (connectionsQuery.data ?? []).some((c) => c.isActive);

  const handleSelectAll = useCallback((): void => {
    if (!filteredItems.length) {
      return;
    }
    const allIds = filteredItems.map((l) => l.id);
    const allSelected = allIds.every((id) => selectedIdSet.has(id));
    if (allSelected) {
      clearListingSelection();
    } else {
      setSelectedListingIds(allIds);
    }
  }, [
    filteredItems,
    selectedIdSet,
    clearListingSelection,
    setSelectedListingIds,
  ]);

  const handleInlinePriceSave = (listing: Listing, price: number): void => {
    setPriceSavingId(listing.id);
    updatePriceMutation.mutate(
      {
        id: listing.id,
        salePrice: price,
        listPrice: Math.max(Number(listing.listPrice), price),
      },
      {
        onSettled: () => {
          setPriceSavingId(null);
        },
      },
    );
  };

  const handleInlineStockSave = (listing: Listing, stock: number): void => {
    setStockSavingId(listing.id);
    updateStockMutation.mutate(
      { id: listing.id, quantity: stock },
      {
        onSettled: () => {
          setStockSavingId(null);
        },
      },
    );
  };

  const handleBulkStatus = (status: ListingStatus): void => {
    if (selectedListingIds.length === 0) {
      return;
    }
    bulkStatusMutation.mutate({ ids: selectedListingIds, status });
    clearListingSelection();
  };

  const handleBulkStockApply = (): void => {
    const stock = Math.round(Number(bulkStockValue));
    if (!Number.isFinite(stock) || stock < 0 || selectedRowsOnPage.length === 0) {
      toast.error('Geçerli bir stok girin');
      return;
    }
    bulkStockMutation.mutate(
      selectedRowsOnPage.map((l) => ({ id: l.id, stock })),
      {
        onSuccess: () => {
          setBulkStockOpen(false);
          clearListingSelection();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.listings')}
        description="Pazaryeri ürünlerinizi yönetin, filtreleyin ve toplu işlem yapın."
        context={navContextLine}
        actions={
          <Button
            type="button"
            className="shrink-0 gap-2"
            disabled={syncListingsMutation.isPending}
            onClick={() => {
              syncListingsMutation.mutate();
            }}
          >
            {syncListingsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Senkronize et
          </Button>
        }
      />

      <ListingsKpiRow showBuyBox={showBuyBox} />

      <ListingFiltersPanel
        showBuyBoxFilter={showBuyBox}
        filters={filters}
        onChange={setFilters}
        searchInput={searchInput}
        onSearchInputChange={(v) => {
          setSearchInput(v);
          setFilters((prev) => ({ ...prev, page: 1 }));
        }}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
            {filteredItems.every((l) => selectedIdSet.has(l.id)) &&
            filteredItems.length > 0
              ? 'Seçimi kaldır'
              : 'Tümünü seç'}
          </Button>

          {selectedListingIds.length > 0 ? (
            <>
              <Badge variant="secondary">{selectedListingIds.length} seçili</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="secondary" size="sm" className="gap-1">
                    Toplu işlem
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      handleBulkStatus('ACTIVE');
                    }}
                  >
                    Aktif yap
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleBulkStatus('INACTIVE');
                    }}
                  >
                    Pasif yap
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setBulkPriceOpen(true);
                    }}
                  >
                    Fiyat güncelle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setBulkStockValue('');
                      setBulkStockOpen(true);
                    }}
                  >
                    Stok güncelle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      bulkSyncMutation.mutate(selectedListingIds, {
                        onSuccess: () => {
                          clearListingSelection();
                        },
                      });
                    }}
                  >
                    Zorla sync et
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      bulkDeleteMutation.mutate(selectedListingIds, {
                        onSuccess: () => {
                          clearListingSelection();
                        },
                      });
                    }}
                  >
                    Platformdan kaldır
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>

        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Sıralama</Label>
          <Select
            value={filters.sort ?? 'updated_desc'}
            onValueChange={(v) => {
              setFilters((prev) => ({ ...prev, sort: v as ListingSort }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listingsQuery.isLoading ? <TableSkeleton rows={8} cols={9} /> : null}

      {listingsQuery.isError ? (
        <QueryErrorAlert
          error={listingsQuery.error}
          onRetry={() => {
            void listingsQuery.refetch();
          }}
        />
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      rawData &&
      filteredItems.length === 0 ? (
        <TablePageEmptyState
          hasMarketplaceConnections={hasMarketplaceConnections}
          connectionsLoading={connectionsQuery.isLoading}
          hasActiveFilters={hasActiveFilters}
          onStartSync={() => {
            syncListingsMutation.mutate();
          }}
          syncDisabled={syncListingsMutation.isPending}
          syncLabel="Listelemeleri senkronize et"
        />
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      rawData &&
      filteredItems.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <ListingsTable
              listings={filteredItems}
              selectedIds={selectedIdSet}
              showBuyBoxColumn={showBuyBox}
              buyBoxMap={showBuyBox ? buyBoxMap : undefined}
              onToggleRow={toggleListingRow}
              onToggleAllOnPage={(selected) => {
                toggleAllOnPage(
                  filteredItems.map((l) => l.id),
                  selected,
                );
              }}
              onInlinePriceSave={handleInlinePriceSave}
              onInlineStockSave={handleInlineStockSave}
              onForceSync={(listing) => {
                syncOneMutation.mutate(listing.id);
              }}
              onRemove={(listing) => {
                bulkDeleteMutation.mutate([listing.id]);
              }}
              priceSavingId={priceSavingId}
              stockSavingId={stockSavingId}
            />
            <DataTablePagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={(nextPage) => {
                setFilters((prev) => ({ ...prev, page: nextPage }));
              }}
              onLimitChange={(nextLimit) => {
                setFilters((prev) => ({ ...prev, limit: nextLimit, page: 1 }));
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <BulkPriceUpdateModal
        open={bulkPriceOpen}
        onOpenChange={setBulkPriceOpen}
        selectedListings={allSelectedListings}
        buyBoxPriceByKey={buyBoxPriceByKey}
        activePlatforms={activePlatforms}
        onSuccess={() => {
          clearListingSelection();
        }}
      />

      <Dialog open={bulkStockOpen} onOpenChange={setBulkStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu stok güncelle</DialogTitle>
            <DialogDescription>
              Seçili {selectedListingIds.length} listeleme için yeni stok miktarı
              uygulanır.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="bulk-stock">Stok adedi</Label>
            <Input
              id="bulk-stock"
              className="mt-1.5"
              inputMode="numeric"
              value={bulkStockValue}
              onChange={(e) => {
                setBulkStockValue(e.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkStockOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={bulkStockMutation.isPending}
              onClick={handleBulkStockApply}
            >
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
