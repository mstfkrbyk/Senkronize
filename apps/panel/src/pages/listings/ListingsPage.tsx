import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Loader2,
  Percent,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';

import { AdvancedFilters } from '@/components/AdvancedFilters';
import { DataTablePagination } from '@/components/DataTablePagination';
import { TablePageEmptyState } from '@/components/TablePageEmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMarketplaceConnections } from '@/hooks/useConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  useListingsPageStore,
} from '@/store/tablePages.store';
import type { Listing, ListingFilters as ListingFiltersState } from '@/types/listing';

import {
  LISTING_FILTER_CONFIG,
  LISTING_FILTER_DEFAULTS,
  LISTING_PAGE_SIZE,
} from './listingFilters.config';
import { ListingDetailSheet } from './ListingDetailSheet';
import { ListingsTable } from './ListingsTable';
import { UpdatePriceDialog } from './UpdatePriceDialog';
import { UpdateStockDialog } from './UpdateStockDialog';
import {
  useBulkListingUpdate,
  useListingSummary,
  useListings,
  useSyncAllPlatforms,
  useSyncListings,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';

const PAGE_SIZE_DEFAULT = LISTING_PAGE_SIZE;

function urlFiltersToListingFilters(
  url: typeof LISTING_FILTER_DEFAULTS,
  search: string,
): ListingFiltersState {
  const platforms = url.platforms.length > 0 ? url.platforms.join(',') : undefined;
  const approved =
    url.approved === 'true' ? true : url.approved === 'false' ? false : undefined;

  return {
    page: url.page,
    limit: url.limit,
    platforms,
    stockTier: url.stockTier,
    minSalePrice: url.minSalePrice,
    maxSalePrice: url.maxSalePrice,
    lastSyncAtSince: url.lastSyncAtSince.trim() || undefined,
    lastSyncAtUntil: url.lastSyncAtUntil.trim() || undefined,
    category: url.category.trim() || undefined,
    approved,
    search: search.trim() || undefined,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeCsvKey(key: string): string {
  return key.trim().toLowerCase();
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadListingsCsv(rows: Listing[]): void {
  const headers = ['barkod', 'baslik', 'fiyat', 'stok', 'platform'];
  const lines = [
    headers.join(','),
    ...rows.map((l) =>
      [
        escapeCsvCell(l.barcode),
        escapeCsvCell(l.title),
        escapeCsvCell(l.salePrice),
        escapeCsvCell(String(l.quantity)),
        escapeCsvCell(l.platform),
      ].join(','),
    ),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `listelemeler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ListingsPage(): ReactElement {
  usePageTitle('Ürünler');
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [urlFilters, setUrlFilters, resetUrlFilters] = useUrlFilters(
    LISTING_FILTER_DEFAULTS,
  );

  const debouncedSearch = useDebouncedValue(urlFilters.search, 300);
  const listingQueryFilters = useMemo(
    () => urlFiltersToListingFilters(urlFilters, debouncedSearch),
    [urlFilters, debouncedSearch],
  );

  const handleFilterChange = useCallback(
    (values: Record<string, unknown>): void => {
      setUrlFilters({
        ...(values as typeof LISTING_FILTER_DEFAULTS),
        page: 1,
      });
    },
    [setUrlFilters],
  );

  const selectedListingIds = useListingsPageStore((s) => s.selectedListingIds);
  const toggleListingRow = useListingsPageStore((s) => s.toggleListingRow);
  const toggleAllOnPage = useListingsPageStore((s) => s.toggleAllOnPage);
  const clearListingSelection = useListingsPageStore((s) => s.clearListingSelection);

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<Listing | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Listing | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [bulkPctOpen, setBulkPctOpen] = useState(false);
  const [bulkPctInput, setBulkPctInput] = useState('0');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const listingsQuery = useListings(listingQueryFilters);
  const summaryQuery = useListingSummary();
  const connectionsQuery = useMarketplaceConnections();
  const syncListingsMutation = useSyncListings();
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();
  const bulkUpdateMutation = useBulkListingUpdate();
  const syncAllPlatformsMutation = useSyncAllPlatforms();
  const [bulkDeletePending, setBulkDeletePending] = useState(false);

  useEffect(() => {
    clearListingSelection();
  }, [
    clearListingSelection,
    listingQueryFilters.page,
    listingQueryFilters.platforms,
    listingQueryFilters.approved,
    listingQueryFilters.stockTier,
    listingQueryFilters.minSalePrice,
    listingQueryFilters.maxSalePrice,
    listingQueryFilters.lastSyncAtSince,
    listingQueryFilters.lastSyncAtUntil,
    listingQueryFilters.category,
    debouncedSearch,
  ]);

  useEffect(() => {
    const unlisten = on('listing:synced', () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success('Ürün listesi güncellendi');
    });
    return unlisten;
  }, [on, queryClient]);

  const data = listingsQuery.data;
  const total = data?.total ?? 0;
  const limit = listingQueryFilters.limit ?? PAGE_SIZE_DEFAULT;
  const page = listingQueryFilters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasMarketplaceConnections =
    connectionsQuery.data === undefined
      ? null
      : (connectionsQuery.data ?? []).some((c) => c.isActive);

  const selectedIdSet = useMemo(
    () => new Set(selectedListingIds),
    [selectedListingIds],
  );

  const selectedRowsOnPage =
    data?.items.filter((l) => selectedIdSet.has(l.id)) ?? [];

  const hasActiveListingFilters = useMemo(() => {
    return Boolean(
      listingQueryFilters.platforms?.trim() ||
        listingQueryFilters.approved !== undefined ||
        listingQueryFilters.stockTier ||
        listingQueryFilters.minSalePrice !== undefined ||
        listingQueryFilters.maxSalePrice !== undefined ||
        listingQueryFilters.lastSyncAtSince?.trim() ||
        listingQueryFilters.lastSyncAtUntil?.trim() ||
        listingQueryFilters.category?.trim() ||
        debouncedSearch.trim(),
    );
  }, [listingQueryFilters, debouncedSearch]);

  const handleRowClick = (listing: Listing): void => {
    setSelectedListing(listing);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean): void => {
    setSheetOpen(open);
    if (!open) {
      setSelectedListing(null);
    }
  };

  const handleBulkPctApply = (): void => {
    const pct = Number(String(bulkPctInput).replace(',', '.'));
    if (!Number.isFinite(pct)) {
      toast.error('Geçerli bir yüzde girin.');
      return;
    }
    if (selectedRowsOnPage.length === 0) {
      return;
    }
    const factor = 1 + pct / 100;
    bulkUpdateMutation.mutate(
      selectedRowsOnPage.map((l) => ({
        listingId: l.id,
        salePrice: Math.max(
          0.01,
          roundMoney(Number(l.salePrice) * factor),
        ),
        listPrice: Math.max(
          0.01,
          roundMoney(Number(l.listPrice) * factor),
        ),
      })),
      {
        onSuccess: () => {
          setBulkPctOpen(false);
        },
      },
    );
  };

  const handleBulkDelete = (): void => {
    const ids = [...selectedIdSet];
    if (ids.length === 0) {
      return;
    }
    setBulkDeletePending(true);
    void (async (): Promise<void> => {
      try {
        let ok = 0;
        for (const id of ids) {
          try {
            await api.delete(`/listings/${id}`);
            ok += 1;
          } catch {
            /* ignore */
          }
        }
        toast.success(`${String(ok)} listeleme arşivlendi`);
        clearListingSelection();
        setDeleteOpen(false);
        void queryClient.invalidateQueries({ queryKey: ['listings'] });
        void queryClient.invalidateQueries({
          queryKey: ['reports', 'dashboard-summary'],
        });
      } finally {
        setBulkDeletePending(false);
      }
    })();
  };

  const handleCsvFile = (file: File): void => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const items: {
          barcode: string;
          quantity?: number;
          salePrice?: number;
          listPrice?: number;
        }[] = [];
        for (const raw of result.data) {
          const row: Record<string, string> = {};
          for (const [k, v] of Object.entries(raw)) {
            row[normalizeCsvKey(k)] = String(v ?? '').trim();
          }
          const barcode = row.barcode ?? row.barkod ?? '';
          if (!barcode) {
            continue;
          }
          const qRaw = row.quantity ?? row.qty ?? row.miktar ?? '';
          const saleRaw = row.saleprice ?? row.price ?? row.fiyat ?? '';
          const listRaw = row.listprice ?? '';
          const entry: (typeof items)[number] = { barcode };
          if (qRaw !== '' && Number.isFinite(Number(qRaw))) {
            entry.quantity = Math.max(0, Math.round(Number(qRaw)));
          }
          if (saleRaw !== '' && Number.isFinite(Number(saleRaw))) {
            entry.salePrice = Number(saleRaw);
          }
          if (listRaw !== '' && Number.isFinite(Number(listRaw))) {
            entry.listPrice = Number(listRaw);
          }
          if (
            entry.quantity === undefined &&
            entry.salePrice === undefined &&
            entry.listPrice === undefined
          ) {
            continue;
          }
          items.push(entry);
        }
        if (items.length === 0) {
          toast.error('CSV içinde güncellenecek satır bulunamadı.');
          return;
        }
        bulkUpdateMutation.mutate(items);
      },
      error: (err: Error) => {
        toast.error(err.message ?? 'CSV okunamadı');
      },
    });
  };

  const showStickyBulk = selectedListingIds.length > 0;

  return (
    <div className={`space-y-6 ${showStickyBulk ? 'pb-24' : ''}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              Ürün listesi
            </h1>
            <p className="text-muted-foreground">
              Pazaryeri listelemelerinizi yönetin ve senkronize edin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {summaryQuery.isLoading ? (
              <>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </>
            ) : null}
            {summaryQuery.isError ? (
              <span className="text-xs text-muted-foreground">
                Özet yüklenemedi
              </span>
            ) : null}
            {!summaryQuery.isLoading && !summaryQuery.isError && summaryQuery.data ? (
              <>
                <Badge variant="secondary">
                  Toplam {summaryQuery.data.total}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50 text-green-800"
                >
                  Onaylı {summaryQuery.data.approved}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-900"
                >
                  Bekleyen {summaryQuery.data.pending}
                </Badge>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) {
                handleCsvFile(f);
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2"
            disabled={bulkUpdateMutation.isPending}
            onClick={() => {
              csvInputRef.current?.click();
            }}
          >
            <Upload className="h-4 w-4" aria-hidden />
            CSV içe aktar
          </Button>
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
            ) : null}
            Senkronize et
          </Button>
        </div>
      </div>

      <AdvancedFilters
        filters={LISTING_FILTER_CONFIG}
        values={urlFilters}
        onChange={handleFilterChange}
        onReset={resetUrlFilters}
      />

      {listingsQuery.isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : null}

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
          hasActiveFilters={hasActiveListingFilters}
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
          onToggleRow={(id, selected) => {
            toggleListingRow(id, selected);
          }}
          onToggleAllOnPage={(selected) => {
            toggleAllOnPage(
              data.items.map((l) => l.id),
              selected,
            );
          }}
          onRowClick={handleRowClick}
          onOpenPrice={(listing) => {
            setPriceTarget(listing);
            setPriceOpen(true);
          }}
          onOpenStock={(listing) => {
            setStockTarget(listing);
            setStockOpen(true);
          }}
          onSyncAllPlatforms={(listing) => {
            syncAllPlatformsMutation.mutate({
              barcode: listing.barcode,
              quantity: listing.quantity,
            });
          }}
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
          onPageChange={(p) => {
            setUrlFilters({ page: p });
          }}
          onLimitChange={(nextLimit) => {
            setUrlFilters({ limit: nextLimit, page: 1 });
          }}
        />
      ) : null}

      {showStickyBulk ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary" className="w-fit shrink-0" aria-live="polite">
              {selectedListingIds.length} seçili
            </Badge>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={
                  selectedListingIds.length === 0 || syncAllPlatformsMutation.isPending
                }
                onClick={() => {
                  syncAllPlatformsMutation.mutate({
                    listingIds: selectedListingIds,
                  });
                  clearListingSelection();
                }}
              >
                {syncAllPlatformsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Zap className="h-3.5 w-3.5" aria-hidden />
                )}
                Seçili ürünleri senkronize et
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedListingIds.length === 0 || !data}
                onClick={() => {
                  if (!data) {
                    return;
                  }
                  const rows = data.items.filter((l) => selectedIdSet.has(l.id));
                  downloadListingsCsv(rows);
                  toast.success('CSV indirildi');
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                Seçili ürünleri dışa aktar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={selectedListingIds.length === 0}
                onClick={() => {
                  setBulkPctInput('0');
                  setBulkPctOpen(true);
                }}
              >
                <Percent className="mr-1 h-3.5 w-3.5" aria-hidden />
                Fiyatı güncelle (%)
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1"
                disabled={
                  selectedListingIds.length === 0 || bulkDeletePending
                }
                onClick={() => {
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Seçili ürünleri sil
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ListingDetailSheet
        listing={selectedListing}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />

      <UpdatePriceDialog
        listing={priceTarget}
        open={priceOpen}
        onOpenChange={(open) => {
          setPriceOpen(open);
          if (!open) {
            setPriceTarget(null);
          }
        }}
        mutation={updatePriceMutation}
      />

      <UpdateStockDialog
        listing={stockTarget}
        open={stockOpen}
        onOpenChange={(open) => {
          setStockOpen(open);
          if (!open) {
            setStockTarget(null);
          }
        }}
        mutation={updateStockMutation}
      />

      <Dialog open={bulkPctOpen} onOpenChange={setBulkPctOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seçili ürünlerin fiyatını güncelle</DialogTitle>
            <DialogDescription>
              Seçili ürünlerin satış ve liste fiyatına yüzde uygulanır (ör. +10 veya
              -5).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="bulk-pct">Yüzde değişim</Label>
            <Input
              id="bulk-pct"
              inputMode="decimal"
              placeholder="örn. 10 veya -5"
              value={bulkPctInput}
              onChange={(e) => {
                setBulkPctInput(e.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkPctOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                bulkUpdateMutation.isPending || selectedRowsOnPage.length === 0
              }
              onClick={() => {
                handleBulkPctApply();
              }}
            >
              {bulkUpdateMutation.isPending ? 'Uygulanıyor…' : 'Uygula'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili ürünleri sil?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedListingIds.length} listeleme arşivlenecek (geri alınamaz
              işlem değildir; kayıtlar pasiflenir).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
              }}
            >
              İptal
            </Button>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                handleBulkDelete();
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
