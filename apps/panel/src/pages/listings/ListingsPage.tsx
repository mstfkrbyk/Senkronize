import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { DataTablePagination } from '@/components/DataTablePagination';
import { TablePageEmptyState } from '@/components/TablePageEmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import { getApiErrorMessage } from '@/lib/api';
import { useListingsPageStore } from '@/store/tablePages.store';
import type {
  Listing,
  ListingFilters,
  ListingSort,
  ListingStatus,
} from '@/types/listing';

import {
  useBulkListingPrice,
  useBulkListingPush,
  useBulkListingStatus,
  useBulkListingStock,
  useListingSummary,
  useListings,
  useSyncListings,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';
import { ListingsTable } from './ListingsTable';

const PAGE_SIZE_DEFAULT = 20;

const STATUS_OPTIONS: { value: ListingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tüm durumlar' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'INACTIVE', label: 'Devre dışı' },
  { value: 'OUT_OF_STOCK', label: 'Stok yok' },
  { value: 'PENDING', label: 'Beklemede' },
];

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'updated_desc', label: 'Son güncelleme' },
  { value: 'price_asc', label: 'Fiyat (artan)' },
  { value: 'price_desc', label: 'Fiyat (azalan)' },
  { value: 'stock_asc', label: 'Stok (artan)' },
  { value: 'stock_desc', label: 'Stok (azalan)' },
];

export function ListingsPage(): ReactElement {
  usePageTitle('Listelemeler');

  const queryClient = useQueryClient();
  const { on } = useSocket();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE_DEFAULT);
  const [platformTab, setPlatformTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'ALL'>('ALL');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stockMin, setStockMin] = useState('');
  const [stockMax, setStockMax] = useState('');
  const [sort, setSort] = useState<ListingSort>('updated_desc');

  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkStockOpen, setBulkStockOpen] = useState(false);
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [stockSavingId, setStockSavingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const selectedListingIds = useListingsPageStore((s) => s.selectedListingIds);
  const toggleListingRow = useListingsPageStore((s) => s.toggleListingRow);
  const toggleAllOnPage = useListingsPageStore((s) => s.toggleAllOnPage);
  const clearListingSelection = useListingsPageStore((s) => s.clearListingSelection);
  const setSelectedListingIds = useListingsPageStore((s) => s.setSelectedListingIds);

  const connectionsQuery = useMarketplaceConnections();
  const summaryQuery = useListingSummary();
  const syncListingsMutation = useSyncListings();
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();
  const bulkStatusMutation = useBulkListingStatus();
  const bulkPriceMutation = useBulkListingPrice();
  const bulkStockMutation = useBulkListingStock();
  const bulkPushMutation = useBulkListingPush();

  const activePlatforms = useMemo(() => {
    const conns = connectionsQuery.data ?? [];
    return conns.filter((c) => c.isActive).map((c) => c.platform);
  }, [connectionsQuery.data]);

  const listingQueryFilters = useMemo((): ListingFilters => {
    const filters: ListingFilters = {
      page,
      limit,
      search: debouncedSearch.trim() || undefined,
      sort,
    };
    if (platformTab !== 'ALL') {
      filters.platform = platformTab;
    }
    if (statusFilter !== 'ALL') {
      filters.status = statusFilter;
    }
    const pMin = Number(priceMin);
    const pMax = Number(priceMax);
    if (priceMin.trim() && Number.isFinite(pMin)) {
      filters.priceMin = pMin;
    }
    if (priceMax.trim() && Number.isFinite(pMax)) {
      filters.priceMax = pMax;
    }
    const sMin = Number(stockMin);
    const sMax = Number(stockMax);
    if (stockMin.trim() && Number.isFinite(sMin)) {
      filters.stockMin = sMin;
    }
    if (stockMax.trim() && Number.isFinite(sMax)) {
      filters.stockMax = sMax;
    }
    return filters;
  }, [
    page,
    limit,
    debouncedSearch,
    sort,
    platformTab,
    statusFilter,
    priceMin,
    priceMax,
    stockMin,
    stockMax,
  ]);

  const listingsQuery = useListings(listingQueryFilters);

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

  const data = listingsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const selectedIdSet = useMemo(
    () => new Set(selectedListingIds),
    [selectedListingIds],
  );

  const selectedRowsOnPage =
    data?.items.filter((l) => selectedIdSet.has(l.id)) ?? [];

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      platformTab !== 'ALL' ||
      statusFilter !== 'ALL' ||
      priceMin.trim() ||
      priceMax.trim() ||
      stockMin.trim() ||
      stockMax.trim(),
  );

  const hasMarketplaceConnections =
    connectionsQuery.data === undefined
      ? null
      : (connectionsQuery.data ?? []).some((c) => c.isActive);

  const handleSelectAll = useCallback((): void => {
    if (!data?.items.length) {
      return;
    }
    const allIds = data.items.map((l) => l.id);
    const allSelected = allIds.every((id) => selectedIdSet.has(id));
    if (allSelected) {
      clearListingSelection();
    } else {
      setSelectedListingIds(allIds);
    }
  }, [data?.items, selectedIdSet, clearListingSelection, setSelectedListingIds]);

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

  const handleBulkPriceApply = (): void => {
    const price = Number(String(bulkPriceValue).replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0 || selectedRowsOnPage.length === 0) {
      toast.error('Geçerli bir fiyat girin');
      return;
    }
    bulkPriceMutation.mutate(
      selectedRowsOnPage.map((l) => ({ id: l.id, price })),
      {
        onSuccess: () => {
          setBulkPriceOpen(false);
          clearListingSelection();
        },
      },
    );
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

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('ALL');
    setPriceMin('');
    setPriceMax('');
    setStockMin('');
    setStockMax('');
    setPlatformTab('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Listelemeler
          </h1>
          <p className="text-muted-foreground">
            Pazaryeri ürünlerinizi yönetin, filtreleyin ve toplu işlem yapın.
          </p>
          {summaryQuery.data ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Toplam {summaryQuery.data.total}</Badge>
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
                Onaylı {summaryQuery.data.approved}
              </Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
                Bekleyen {summaryQuery.data.pending}
              </Badge>
            </div>
          ) : null}
        </div>
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
      </div>

      <Tabs
        value={platformTab}
        onValueChange={(v) => {
          setPlatformTab(v);
          setPage(1);
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="ALL" className="data-[state=active]:bg-muted">
            Tümü
          </TabsTrigger>
          {activePlatforms.map((platform) => {
            const branding = getMarketplaceBranding(platform);
            return (
              <TabsTrigger
                key={platform}
                value={platform}
                className="gap-1.5 data-[state=active]:bg-muted"
              >
                <span aria-hidden>{branding.logo}</span>
                {branding.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Ürün adı veya barkod ara…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Durum</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as ListingStatus | 'ALL');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Fiyat min</Label>
            <Input
              className="w-24"
              inputMode="decimal"
              placeholder="Min"
              value={priceMin}
              onChange={(e) => {
                setPriceMin(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Fiyat max</Label>
            <Input
              className="w-24"
              inputMode="decimal"
              placeholder="Max"
              value={priceMax}
              onChange={(e) => {
                setPriceMax(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Stok min</Label>
            <Input
              className="w-20"
              inputMode="numeric"
              placeholder="Min"
              value={stockMin}
              onChange={(e) => {
                setStockMin(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Stok max</Label>
            <Input
              className="w-20"
              inputMode="numeric"
              placeholder="Max"
              value={stockMax}
              onChange={(e) => {
                setStockMax(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Sıralama</Label>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as ListingSort);
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

          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" aria-hidden />
              Temizle
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
          {data?.items.every((l) => selectedIdSet.has(l.id)) && (data?.items.length ?? 0) > 0
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
                  Aktifleştir
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleBulkStatus('INACTIVE');
                  }}
                >
                  Devre dışı bırak
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setBulkPriceValue('');
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
                <DropdownMenuItem
                  onClick={() => {
                    bulkPushMutation.mutate(selectedListingIds, {
                      onSuccess: () => {
                        clearListingSelection();
                      },
                    });
                  }}
                >
                  Platforma gönder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>

      {listingsQuery.isLoading ? <TableSkeleton rows={8} cols={8} /> : null}

      {listingsQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(listingsQuery.error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void listingsQuery.refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length === 0 ? (
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
      data &&
      data.items.length > 0 ? (
        <ListingsTable
          listings={data.items}
          selectedIds={selectedIdSet}
          onToggleRow={toggleListingRow}
          onToggleAllOnPage={(selected) => {
            toggleAllOnPage(
              data.items.map((l) => l.id),
              selected,
            );
          }}
          onInlinePriceSave={handleInlinePriceSave}
          onInlineStockSave={handleInlineStockSave}
          priceSavingId={priceSavingId}
          stockSavingId={stockSavingId}
        />
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length > 0 ? (
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
        />
      ) : null}

      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu fiyat güncelle</DialogTitle>
            <DialogDescription>
              Seçili {selectedListingIds.length} listeleme için yeni satış fiyatı
              uygulanır.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="bulk-price">Yeni fiyat (₺)</Label>
            <Input
              id="bulk-price"
              className="mt-1.5"
              inputMode="decimal"
              value={bulkPriceValue}
              onChange={(e) => {
                setBulkPriceValue(e.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkPriceOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={bulkPriceMutation.isPending}
              onClick={handleBulkPriceApply}
            >
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
