import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/EmptyState';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { Listing } from '@/types/listing';

export function LowStockWidget(): ReactElement {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: async (): Promise<Listing[]> => {
      const { data } = await api.get<{ items: Listing[] }>('/listings', {
        params: { stockTier: 'LOW', limit: 5, page: 1 },
      });
      return data.items;
    },
  });

  const chartData = (query.data ?? []).map((l) => ({
    name: l.barcode.slice(-6),
    stok: l.quantity,
  }));

  return (
    <Card
      className="h-full cursor-pointer transition-colors hover:border-accent/50"
      onClick={() => {
        navigate('/listings?stockTier=LOW');
      }}
    >
      <CardHeader>
        <CardTitle>Düşük stok</CardTitle>
        <CardDescription>En kritik 5 ürün</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Skeleton className="h-32 w-full" /> : null}
        {!query.isPending && (query.data?.length ?? 0) === 0 ? (
          <EmptyState title="Düşük stok yok" description="Tüm ürünler yeterli stokta." />
        ) : null}
        {!query.isPending && query.data && query.data.length > 0 ? (
          <>
            <div className="mb-3 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={48}
                    tick={{ fontSize: 10 }}
                  />
                  <Bar dataKey="stok" fill="hsl(38 92% 50%)" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {query.data.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{l.title}</span>
                  <span className="shrink-0 tabular-nums text-amber-700 dark:text-amber-400">
                    {l.quantity} adet · {getMarketplaceBranding(l.platform).label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
