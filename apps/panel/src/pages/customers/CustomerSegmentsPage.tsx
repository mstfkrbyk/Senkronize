import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatCustomerSegmentsNavContext } from '@/pages/customers/customers-nav-context';
import { customersT } from '@/pages/customers/translations';
import {
  formatTryAmount,
  SEGMENT_BADGE_CLASS,
  SEGMENT_CHART_COLORS,
  SEGMENT_CRITERIA,
  SEGMENT_LABELS,
} from '@/lib/customer-segments';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { CustomerSegmentKey, CustomerSegmentsSummary } from '@/types/customer';

const SEGMENT_ORDER: CustomerSegmentKey[] = [
  'VIP',
  'sadik',
  'yeni',
  'risk',
  'kayip',
];

interface SegmentsPageHeaderProps {
  navContextLine: string;
  withBackButton?: boolean;
}

function SegmentsPageHeader({
  navContextLine,
  withBackButton = false,
}: SegmentsPageHeaderProps): ReactElement {
  const titleBlock = (
    <div>
      <p className="text-sm text-muted-foreground">{navContextLine}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        {customersT('segments.pageTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {customersT('segments.subtitle')}
      </p>
    </div>
  );

  if (!withBackButton) {
    return titleBlock;
  }

  return (
    <div className="flex items-start gap-3">
      <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
        <Link to="/customers">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      {titleBlock}
    </div>
  );
}

export function CustomerSegmentsPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const navContextLine = formatCustomerSegmentsNavContext(
    groupLabel,
    t('nav.customers'),
    orgProducts,
    t,
  );

  usePageTitle(customersT('segments.pageTitle'));
  const { mode, isLoading: accountingModeLoading } = useAccountingMode();
  const isNativeAccounting = mode === 'NATIVE';
  const showSegments = !accountingModeLoading && !isNativeAccounting;

  const segmentsQuery = useQuery({
    queryKey: ['customer-segments'],
    enabled: showSegments,
    queryFn: async (): Promise<CustomerSegmentsSummary> => {
      const { data } = await api.get<{ data: CustomerSegmentsSummary }>(
        '/customers/segments',
      );
      return data.data;
    },
  });

  const chartData = useMemo(() => {
    if (!segmentsQuery.data) {
      return [];
    }
    return SEGMENT_ORDER.map((key) => ({
      name: SEGMENT_LABELS[key],
      key,
      value: segmentsQuery.data[key].count,
      revenue: Number(segmentsQuery.data[key].totalRevenue),
    })).filter((d) => d.value > 0);
  }, [segmentsQuery.data]);

  if (accountingModeLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <SegmentsPageHeader navContextLine={navContextLine} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (isNativeAccounting) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <SegmentsPageHeader navContextLine={navContextLine} />
        <EmptyState
          icon={PieChartIcon}
          title={customersT('segments.guard.title')}
          description={customersT('segments.guard.description')}
          actionSlot={
            <Button asChild variant="outline">
              <Link to="/customers">{customersT('segments.guard.back')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (segmentsQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <SegmentsPageHeader navContextLine={navContextLine} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (segmentsQuery.isError || !segmentsQuery.data) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <SegmentsPageHeader navContextLine={navContextLine} withBackButton />
        <EmptyState
          icon={PieChartIcon}
          title={customersT('segments.error.loadFailed')}
          description={getApiErrorMessage(segmentsQuery.error)}
          actionSlot={
            <Button asChild variant="outline">
              <Link to="/customers">{customersT('segments.guard.back')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const summary = segmentsQuery.data;
  const totalAssignments = SEGMENT_ORDER.reduce(
    (sum, key) => sum + summary[key].count,
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <SegmentsPageHeader navContextLine={navContextLine} withBackButton />

      <TooltipProvider delayDuration={200}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {SEGMENT_ORDER.map((key) => {
            const stats = summary[key];
            const avgSpend =
              stats.count > 0
                ? Number(stats.totalRevenue) / stats.count
                : 0;
            const emailButton = (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled
                aria-disabled
              >
                <Mail className="mr-2 size-4" aria-hidden />
                {customersT('segments.email.button')}
              </Button>
            );
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="outline" className={SEGMENT_BADGE_CLASS[key]}>
                      {SEGMENT_LABELS[key]}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{SEGMENT_CRITERIA[key]}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-3xl font-semibold tabular-nums">
                    {stats.count.toLocaleString('tr-TR')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ort. harcama: {formatTryAmount(avgSpend)}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full">{emailButton}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-center">
                      {SEGMENT_LABELS[key]} {customersT('segments.email.tooltip')}
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segment dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {customersT('segments.empty.chart')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={SEGMENT_CHART_COLORS[entry.key]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v, _name, item) => {
                      const payload = item?.payload as {
                        revenue?: number;
                      } | undefined;
                      const count = Number(v ?? 0);
                      const rev = payload?.revenue ?? 0;
                      return [
                        `${count.toLocaleString('tr-TR')} müşteri · ${formatTryAmount(rev)} gelir`,
                        String(item?.name ?? ''),
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segment kriterleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Segmentler çakışabilir; bir müşteri birden fazla segmentte görünebilir.
              Toplam segment ataması:{' '}
              <strong>{totalAssignments.toLocaleString('tr-TR')}</strong>
            </p>
            <ul className="space-y-3">
              {SEGMENT_ORDER.map((key) => (
                <li key={key} className="flex gap-2">
                  <Badge variant="outline" className={SEGMENT_BADGE_CLASS[key]}>
                    {SEGMENT_LABELS[key]}
                  </Badge>
                  <span className="text-muted-foreground">{SEGMENT_CRITERIA[key]}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline">
              <Link to="/customers">{customersT('segments.backToList')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
