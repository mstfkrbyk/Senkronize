import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plug, ShoppingCart, Building2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminPlatformStats } from '@/types/admin';

export function AdminDashboardPage(): ReactElement {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async (): Promise<AdminPlatformStats> => {
      const { data: res } = await api.get<AdminPlatformStats>('/admin/stats');
      return res;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
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
    );
  }

  const items: {
    title: string;
    value: number;
    icon: typeof Building2;
    tone: string;
  }[] = [
    {
      title: 'Toplam organizasyon',
      value: data.totalOrgs,
      icon: Building2,
      tone: 'text-sky-600',
    },
    {
      title: 'Aktif abonelik',
      value: data.activeSubscriptions,
      icon: Sparkles,
      tone: 'text-emerald-600',
    },
    {
      title: 'Deneme aboneliği',
      value: data.trialOrgs,
      icon: Package,
      tone: 'text-amber-600',
    },
    {
      title: 'Aktif pazaryeri bağlantısı',
      value: data.totalConnections,
      icon: Plug,
      tone: 'text-violet-600',
    },
    {
      title: 'Toplam sipariş',
      value: data.totalOrders,
      icon: ShoppingCart,
      tone: 'text-slate-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ title, value, icon: Icon, tone }) => (
          <Card key={title} className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
              <Icon className={`size-5 ${tone}`} aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-primary">
                {value.toLocaleString('tr-TR')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
