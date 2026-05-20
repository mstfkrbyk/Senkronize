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
import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { api, getApiErrorMessage } from '@/lib/api';
import type { DashboardTopProductRow } from '@/types/dashboard-widgets';

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TopProductsWidget(): ReactElement {
  const { api: periodApi } = useDashboardPeriod();

  const query = useQuery({
    queryKey: ['dashboard', 'top-products', periodApi.queryKey],
    queryFn: async (): Promise<DashboardTopProductRow[]> => {
      const { data } = await api.get<DashboardTopProductRow[]>('/dashboard/top-products', {
        params: { period: periodApi.kpiPeriod, limit: 10 },
      });
      return data;
    },
    staleTime: 120_000,
  });

  const products = (query.data ?? []).slice(0, 10);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>En çok satan ürünler</CardTitle>
        <CardDescription>Seçili dönem · ilk 10 ürün</CardDescription>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Ürün</th>
                  <th className="pb-2 pr-2 font-medium text-right">Satış</th>
                  <th className="pb-2 font-medium text-right">Gelir</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, index) => (
                  <tr key={row.sku ?? row.name ?? String(index)} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-muted-foreground">{index + 1}</td>
                    <td className="max-w-[180px] truncate py-2 pr-2 font-medium">
                      {row.name?.trim() || row.sku || '—'}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.sales}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {formatTry(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
