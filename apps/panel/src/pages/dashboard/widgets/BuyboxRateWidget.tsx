import { Trophy } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
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

export function BuyboxRateWidget(): ReactElement {
  const navigate = useNavigate();
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
  const delta = dash?.buyboxWinRateDeltaPct ?? 0;
  const positive = delta >= 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>BuyBox oranı</CardTitle>
          <CardDescription>Son 7 güne göre değişim</CardDescription>
        </div>
        <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? (
          <Skeleton className="h-12 w-32" />
        ) : (
          <>
            <p className="text-4xl font-bold tabular-nums">
              {dash ? `${String(dash.buyboxWinRatePct)}%` : '—'}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className={positive ? 'text-green-600' : 'text-red-600'}>
                {positive ? '+' : ''}
                {String(delta)}%
              </span>{' '}
              önceki döneme göre
            </p>
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigate('/pricing');
          }}
        >
          Fiyatlandırmaya git
        </Button>
      </CardContent>
    </Card>
  );
}
