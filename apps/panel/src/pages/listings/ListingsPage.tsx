import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocket } from '@/hooks/useSocket';
import { getApiErrorMessage } from '@/lib/api';
import type { Listing, ListingFilters as ListingFiltersState } from '@/types/listing';

import { ListingDetailSheet } from './ListingDetailSheet';
import { ListingFilters } from './ListingFilters';
import { ListingsTable } from './ListingsTable';
import { UpdatePriceDialog } from './UpdatePriceDialog';
import { UpdateStockDialog } from './UpdateStockDialog';
import {
  useListingSummary,
  useListings,
  useSyncListings,
  useUpdatePrice,
  useUpdateStock,
} from './hooks/useListings';

const PAGE_SIZE = 20;

export function ListingsPage(): ReactElement {
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const [filters, setFilters] = useState<ListingFiltersState>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<Listing | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Listing | null>(null);
  const [stockOpen, setStockOpen] = useState(false);

  const listingsQuery = useListings(filters);
  const summaryQuery = useListingSummary();
  const syncMutation = useSyncListings();
  const updatePriceMutation = useUpdatePrice();
  const updateStockMutation = useUpdateStock();

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

      <ListingFilters filters={filters} onChange={setFilters} />

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
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Henüz listeleme yok veya filtrelere uygun kayıt bulunamadı.
        </p>
      ) : null}

      {!listingsQuery.isLoading &&
      !listingsQuery.isError &&
      data &&
      data.items.length > 0 ? (
        <ListingsTable
          listings={data.items}
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
    </div>
  );
}
