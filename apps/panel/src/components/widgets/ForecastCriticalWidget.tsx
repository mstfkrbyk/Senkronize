import { LineChart } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { StockForecastSummaryDto } from '@/types/stock-forecast';

export function ForecastCriticalWidget(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['dashboard', 'forecast-summary'],
    queryFn: async (): Promise<StockForecastSummaryDto> => {
      const { data } = await api.get<StockForecastSummaryDto>(
        '/stock/forecast/summary',
      );
      return data;
    },
    staleTime: 60_000,
  });

  const count = query.data?.countWithin7Days ?? 0;

  return (
    <Card
      className="h-full cursor-pointer transition-colors hover:border-accent/50"
      onClick={() => {
        navigate('/products?tab=forecast');
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t('dashboard.stockForecastCriticalTitle')}
        </CardTitle>
        <div className="rounded-full bg-background p-2 ring-2 ring-sky-100 dark:ring-sky-900/50">
          <LineChart className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <>
            <p
              className={`text-2xl font-bold tabular-nums ${
                count > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {count}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('dashboard.stockForecastCriticalHint')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
