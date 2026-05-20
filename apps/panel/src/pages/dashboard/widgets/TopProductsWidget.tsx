import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/EmptyState';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import type { TopProductsResponse } from '@/types/analytics';

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TopProductsWidget(): ReactElement {
  const query = useQuery({
    queryKey: ['dashboard', 'top-products'],
    queryFn: async (): Promise<TopProductsResponse> => {
      const { data } = await api.get<TopProductsResponse>('/analytics/top-products', {
        params: { period: '7d', limit: 5 },
      });
      return data;
    },
    staleTime: 120_000,
  });

  const products = (query.data?.products ?? []).slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>En çok satan ürünler</CardTitle>
        <CardDescription>Son 7 gün · ilk 5 ürün</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {query.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(query.error)}</p>
        ) : null}
        {!query.isLoading && !query.isError && products.length === 0 ? (
          <EmptyState title="Veri yok" description="Henüz satış kaydı bulunmuyor." />
        ) : null}
        {!query.isLoading && products.length > 0 ? (
          <ol className="space-y-2">
            {products.map((row, index) => (
              <li
                key={row.barcode}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="mr-2 font-medium text-muted-foreground">
                    {String(index + 1)}.
                  </span>
                  <span className="font-medium">
                    {row.productName?.trim() || row.barcode}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {row.quantity} adet · {row.orderCount} sipariş
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatTry(row.revenue)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
