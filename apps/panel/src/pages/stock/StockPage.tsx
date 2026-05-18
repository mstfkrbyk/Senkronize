import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/TableSkeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/hooks/useSocket';
import { getApiErrorMessage } from '@/lib/api';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { StockFilters as StockFiltersState } from '@/types/stock';

import { LowStockAlert } from './LowStockAlert';
import { StockTable } from './StockTable';
import { useLowStock, useStock } from './hooks/useStock';

const PAGE_SIZE = 20;

function isStockAlertPayload(
  data: unknown,
): data is { barcode: string; quantity: number } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const o = data as Record<string, unknown>;
  return typeof o.barcode === 'string' && typeof o.quantity === 'number';
}

export function StockPage(): ReactElement {
  usePageTitle('Stok');
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const [filters, setFilters] = useState<StockFiltersState>({
    page: 1,
    limit: PAGE_SIZE,
  });

  const stockQuery = useStock(filters);
  const lowStockQuery = useLowStock(10);

  useEffect(() => {
    const unlisten = on('stock:alert', (data: unknown) => {
      if (!isStockAlertPayload(data)) {
        return;
      }
      toast.warning(
        `Stok uyarısı: ${data.barcode} → ${data.quantity} adet`,
      );
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    });
    return unlisten;
  }, [on, queryClient]);

  const setField = <K extends keyof StockFiltersState>(
    key: K,
    value: StockFiltersState[K] | undefined,
  ): void => {
    setFilters((f) => ({
      ...f,
      [key]: value,
      page: 1,
    }));
  };

  const handleClear = (): void => {
    setFilters({ page: 1, limit: PAGE_SIZE });
  };

  const list = stockQuery.data?.items ?? [];
  const total = stockQuery.data?.total ?? 0;
  const limit = filters.limit ?? PAGE_SIZE;
  const page = filters.page ?? 1;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;
  const criticalCount = lowStockQuery.data?.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Stok yönetimi
        </h1>
        <p className="text-muted-foreground">
          Ürün stoklarınızı izleyin ve düşük stok uyarılarını takip edin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam SKU</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stockQuery.isLoading ? '—' : total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Kritik stok</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-800">
              {lowStockQuery.isLoading ? '—' : (criticalCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Toplam stok değeri</CardDescription>
            <CardTitle className="text-2xl text-muted-foreground">—</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <LowStockAlert />

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="grid min-w-0 flex-1 gap-2 md:min-w-[200px]">
          <Label htmlFor="stock-search">Ara</Label>
          <Input
            id="stock-search"
            placeholder="Ürün adı, barkod veya SKU"
            value={filters.search ?? ''}
            onChange={(e) =>
              setField('search', e.target.value ? e.target.value : undefined)
            }
          />
        </div>

        <div className="grid gap-2 md:min-w-[160px]">
          <Label htmlFor="stock-platform">Platform</Label>
          <Select
            value={filters.platform ?? 'all'}
            onValueChange={(v) =>
              setField('platform', v === 'all' ? undefined : v)
            }
          >
            <SelectTrigger id="stock-platform">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {MARKETPLACE_OPTIONS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 md:min-w-[180px]">
          <Label htmlFor="stock-low">Stok seviyesi</Label>
          <Select
            value={filters.lowStock === true ? 'low' : 'all'}
            onValueChange={(v) =>
              setField('lowStock', v === 'low' ? true : undefined)
            }
          >
            <SelectTrigger id="stock-low">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="low">Düşük stok</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" onClick={handleClear}>
          Temizle
        </Button>
      </div>

      {stockQuery.isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : null}

      {stockQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(stockQuery.error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void stockQuery.refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!stockQuery.isLoading &&
      !stockQuery.isError &&
      list.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Henüz stok kaydı yok veya filtrelere uygun sonuç bulunamadı.
        </p>
      ) : null}

      {!stockQuery.isLoading && !stockQuery.isError && list.length > 0 ? (
        <StockTable entries={list} />
      ) : null}

      {!stockQuery.isLoading && !stockQuery.isError && list.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Toplam {total} kayıt · Sayfa {page}
            {hasNext ? ' · Daha fazla kayıt olabilir' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev}
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
              disabled={!hasNext}
              onClick={() => {
                setFilters((f) => ({
                  ...f,
                  page: (f.page ?? 1) + 1,
                }));
              }}
            >
              Sonraki
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
