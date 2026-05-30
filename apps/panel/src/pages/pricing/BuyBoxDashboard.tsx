import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import type { BuyBoxSummary } from '@/types/pricing';

interface Props {
  summaryQuery: {
    data: BuyBoxSummary | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch?: () => Promise<unknown>;
  };
}

function platformLabel(code: string): string {
  const map: Record<string, string> = {
    TRENDYOL: 'Trendyol',
    HEPSIBURADA: 'Hepsiburada',
    N11: 'n11',
    AMAZON_TR: 'Amazon TR',
  };
  return map[code] ?? code;
}

export function BuyBoxDashboard({ summaryQuery }: Props): ReactElement {
  const { data, isLoading, isError, error, refetch } = summaryQuery;

  const isPaymentRequired =
    isError &&
    isAxiosError(error) &&
    error.response?.status === 402;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full md:col-span-3" />
      </div>
    );
  }

  if (isPaymentRequired) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        PRO paket gerekli: BuyBox özeti için aboneliğinizi yükseltmeniz gerekir.
      </div>
    );
  }

  if (isError && !isPaymentRequired) {
    return (
      <QueryErrorAlert
        error={error}
        onRetry={
          refetch
            ? () => {
                void refetch();
              }
            : undefined
        }
      />
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        BuyBox özeti yüklenemedi.
      </p>
    );
  }

  const winPct = data.winRate <= 1 && data.winRate >= 0 ? data.winRate * 100 : data.winRate;

  const chartData = data.platforms.map((p) => {
    const w = p.winRate <= 1 && p.winRate >= 0 ? p.winRate * 100 : p.winRate;
    return {
      name: platformLabel(p.platform),
      winRate: Math.round(w * 100) / 100,
      listings: p.listings,
    };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              BuyBox kazanma oranı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-sky-600">
              %{winPct.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kazanılan listeler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">
              {data.winningBuyBox}
              <span className="text-lg font-normal text-muted-foreground">
                {' '}
                / {data.totalListings}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktif kurallar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{data.activeRules}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform bazlı kazanma</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Platform verisi yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const v = value == null ? 0 : Number(value);
                    if (name === 'winRate') {
                      return [`%${v.toFixed(1)}`, 'Kazanma oranı'];
                    }
                    return [v, 'Listeleme'];
                  }}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="winRate" fill="#38bdf8" name="winRate" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
