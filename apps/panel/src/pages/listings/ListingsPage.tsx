import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Percent, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSocket } from '@/hooks/useSocket';
import { getApiErrorMessage } from '@/lib/api';
import type { Listing, ListingFilters as ListingFiltersState } from '@/types/listing';

import { ListingDetailSheet } from './ListingDetailSheet';
import { ListingFilters } from './ListingFilters';
import { ListingsTable } from './ListingsTable';
import { UpdatePriceDialog } from './UpdatePriceDialog';
import { UpdateStockDialog } from './UpdateStockDialog';
import {
  useBulkListingUpdate,
  useListingSummary,
  useListings,
  useSyncListings,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';

const PAGE_SIZE = 20;

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
  const queryClient = useQueryClient();
  const { on } = useSocket();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<ListingFiltersState>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [searchDraft, setSearchDraft] = useState('');
  const debouncedSearch = useDebouncedValue(searchDraft, 300);
  const listingQueryFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
    }),
    [filters, debouncedSearch],
  );

  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setFilters((f) => ({ ...f, page: 1 }));
    }
  }, [debouncedSearch]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<Listing | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Listing | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPctOpen, setBulkPctOpen] = useState(false);
  const [bulkPctInput, setBulkPctInput] = useState('0');

  const listingsQuery = useListings(listingQueryFilters);
  const summaryQuery = useListingSummary();
  const syncMutation = useSyncListings();
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();
  const bulkUpdateMutation = useBulkListingUpdate();

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.page, filters.platform, filters.approved, debouncedSearch]);

  useEffect(() => {
    const unlisten = on('listing:synced', () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success('Ürün listesi güncellendi');
    });
    return unlisten;
  }, [on, queryClient]);

  const data = listingsQuery.data;
  const total = data?.total ?? 0;
  const limit = filters.limit ?? PAGE_SIZE;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

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

  const selectedRowsOnPage =
    data?.items.filter((l) => selectedIds.has(l.id)) ?? [];

  const handleBulkResetStock = (): void => {
    if (selectedRowsOnPage.length === 0) {
      return;
    }
    bulkUpdateMutation.mutate(
      selectedRowsOnPage.map((l) => ({ listingId: l.id, quantity: 0 })),
    );
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

  return (
    <div className="space-y-6">
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
        <Button
          type="button"
          className="shrink-0 gap-2"
          disabled={syncMutation.isPending}
          onClick={() => {
            syncMutation.mutate();
          }}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Senkronize et
        </Button>
      </div>

      <ListingFilters
        filters={filters}
        onChange={setFilters}
        searchInput={searchDraft}
        onSearchInputChange={setSearchDraft}
      />

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
          <Badge variant="secondary" aria-live="polite">
            {selectedIds.size} seçili
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                selectedIds.size === 0 || bulkUpdateMutation.isPending
              }
              onClick={() => {
                handleBulkResetStock();
              }}
            >
              Toplu stok sıfırla
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setBulkPctInput('0');
                setBulkPctOpen(true);
              }}
            >
              <Percent className="mr-1 h-3.5 w-3.5" aria-hidden />
              Toplu fiyat (%)
            </Button>
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
              size="sm"
              disabled={bulkUpdateMutation.isPending}
              onClick={() => {
                csvInputRef.current?.click();
              }}
            >
              <Upload className="mr-1 h-3.5 w-3.5" aria-hidden />
              CSV içe aktar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={selectedIds.size === 0}
              onClick={() => {
                const rows = data.items.filter((l) => selectedIds.has(l.id));
                downloadListingsCsv(rows);
                toast.success('CSV indirildi');
              }}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Seçilenleri dışa aktar
            </Button>
          </div>
        </div>
      ) : null}

      {listingsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
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
        <EmptyState
          title="Henüz listeleme yok"
          description="Filtrelere uygun kayıt bulunamadı veya henüz pazaryeri listesi çekilmedi."
        />
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length > 0 ? (
        <ListingsTable
          listings={data.items}
          selectedIds={selectedIds}
          onToggleRow={(id, selected) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (selected) {
                next.add(id);
              } else {
                next.delete(id);
              }
              return next;
            });
          }}
          onToggleAllOnPage={(selected) => {
            const ids = data.items.map((l) => l.id);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (selected) {
                  next.add(id);
                } else {
                  next.delete(id);
                }
              }
              return next;
            });
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
        />
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Toplam {total} kayıt · Sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setFilters((f) => ({
                  ...f,
                  page: Math.max(1, (f.page ?? 1) - 1),
                }));
              }}
            >
              Önceki
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                setFilters((f) => ({
                  ...f,
                  page: Math.min(totalPages, (f.page ?? 1) + 1),
                }));
              }}
            >
              Sonraki
            </Button>
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
            <DialogTitle>Toplu fiyat güncelle</DialogTitle>
            <DialogDescription>
              Seçili ürünlerin satış ve liste fiyatına yüzde uygulanır (ör. +10
              veya -5).
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
    </div>
  );
}
