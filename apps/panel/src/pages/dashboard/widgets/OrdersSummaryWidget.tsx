import { ShoppingCart } from 'lucide-react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { DashboardApiSummary } from '@/types/dashboard-widgets';

export function OrdersSummaryWidget(): ReactElement {
  const query = useQuery({
    queryKey: ['dashboard', 'summary', 'default'],
    queryFn: async (): Promise<DashboardApiSummary> => {
      const { data } = await api.get<DashboardApiSummary>('/dashboard/summary', {
        params: { period: 'default' },
      });
      return data;
    },
    staleTime: 60_000,
  });

  const dash = query.data;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Sipariş özeti</CardTitle>
          <CardDescription>Bugün ve bekleyen siparişler</CardDescription>
        </div>
        <ShoppingCart className="h-5 w-5 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Bugünkü sipariş</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {dash?.todayOrders ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Düne göre {(dash?.todayOrdersDelta ?? 0) >= 0 ? '+' : ''}
                {String(dash?.todayOrdersDelta ?? 0)}%
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Bekleyen</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {dash?.pendingOrders ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">işlem bekliyor</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
