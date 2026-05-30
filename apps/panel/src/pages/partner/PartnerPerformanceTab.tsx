import type { ReactElement } from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TableSkeleton } from '@/components/TableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePartnerPerformance } from './hooks/usePartner';
import { PartnerPageHeader } from './PartnerPageHeader';
import { formatTry } from './partner-utils';

export function PartnerPerformanceTab(): ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } = usePartnerPerformance();

  const pageHeader = (
    <PartnerPageHeader
      title={t('partner.pages.performance.title')}
      description={t('partner.pages.performance.description')}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        {pageHeader}
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="rounded-md border p-4">
          <TableSkeleton rows={5} cols={2} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={BarChart3}
          title={t('partner.pages.performance.errorTitle')}
          description={t('partner.pages.performance.errorDescription')}
          actionSlot={
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t('partner.pages.performance.retry')}
            </Button>
          }
        />
        <QueryErrorAlert error={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={BarChart3}
          title={t('partner.pages.performance.emptyTitle')}
          description={t('partner.pages.performance.emptyDescription')}
        />
      </div>
    );
  }

  const topProfitableClients = data.topProfitableClients ?? [];
  const avgCap = Math.max(data.avgCommissionPerClientTRY * 2, 1);
  const progressPct = Math.min(
    100,
    Math.round((data.avgCommissionPerClientTRY / avgCap) * 100),
  );

  return (
    <div className="space-y-8">
      {pageHeader}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('partner.pages.performance.activeClients')}</CardDescription>
            <CardTitle className="text-3xl">{data.totalActiveClients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('partner.pages.performance.newClientsThisMonth')}</CardDescription>
            <CardTitle className="text-3xl">{data.newClientsThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('partner.pages.performance.avgCommissionPerClient')}</CardDescription>
            <CardTitle className="text-2xl">{formatTry(data.avgCommissionPerClientTRY)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPct} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('partner.pages.performance.distributionSummary')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">
          {t('partner.pages.performance.topProfitableHeading')}
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partner.pages.performance.tableClient')}</TableHead>
                <TableHead className="text-right">
                  {t('partner.pages.performance.tableCommissionTry')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProfitableClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                    {t('partner.pages.performance.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                topProfitableClients.map((c) => (
                  <TableRow key={c.clientOrgId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTry(c.commissionThisMonthTRY)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
