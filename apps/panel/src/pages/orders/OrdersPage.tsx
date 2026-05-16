import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import type { Order, OrderFilters as OrderFiltersState } from '@/types/order';

import { OrderDetailSheet } from './OrderDetailSheet';
import { OrderFilters } from './OrderFilters';
import { OrdersTable } from './OrdersTable';
import { useOrders } from './hooks/useOrders';

const PAGE_SIZE = 20;

export function OrdersPage(): ReactElement {
  const [filters, setFilters] = useState<OrderFiltersState>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useOrders(filters);

  const total = data?.total ?? 0;
  const limit = filters.limit ?? PAGE_SIZE;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleRowClick = (order: Order): void => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean): void => {
    setSheetOpen(open);
    if (!open) {
      setSelectedOrder(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Siparişler
        </h1>
        <p className="text-muted-foreground">
          Pazaryeri siparişlerinizi filtreleyin ve detaylarını görüntüleyin.
        </p>
      </div>

      <OrderFilters filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data && data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Henüz sipariş yok veya filtrelere uygun kayıt bulunamadı.
        </p>
      ) : null}

      {!isLoading && !isError && data && data.items.length > 0 ? (
        <OrdersTable orders={data.items} onRowClick={handleRowClick} />
      ) : null}

      {!isLoading && !isError && data && data.items.length > 0 ? (
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

      <OrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  );
}
