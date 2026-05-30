import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, History, Loader2 } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerCommissions, usePartnerQueriesEnabled } from './hooks/usePartner';
import { downloadPartnerCommissionHistoryCsv } from './partner-commission-csv';
import {
  commissionLedgerStatusLabel,
  commissionTypeLabel,
} from './partner-commission-labels';
import { formatTry } from './partner-utils';

function ledgerStatusBadge(
  status: string,
  t: ReturnType<typeof useTranslation>['t'],
): ReactElement {
  const label = commissionLedgerStatusLabel(status, t);
  const upper = status.trim().toUpperCase();
  if (upper === 'PENDING') {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{label}</Badge>;
  }
  if (upper === 'SETTLED') {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{label}</Badge>;
  }
  if (upper === 'CANCELLED') {
    return <Badge variant="secondary">{label}</Badge>;
  }
  return <Badge variant="outline">{label}</Badge>;
}

function formatLedgerAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return formatTry(n);
}

export function PartnerCommissionHistoryTab(): ReactElement {
  const { t } = useTranslation();
  const { isPending: authPending } = useAuth();
  const partnerQueriesEnabled = usePartnerQueriesEnabled();
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isPending, isError, error, refetch } = usePartnerCommissions(
    page,
    limit,
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const monthLabel = useMemo(() => {
    return format(new Date(), 'MMMM yyyy', { locale: tr });
  }, []);

  const exportCsv = useCallback(() => {
    if (items.length === 0) {
      return;
    }
    downloadPartnerCommissionHistoryCsv(items, page);
  }, [items, page]);

  if (authPending) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('partner.pages.commission.authPending')}
      </p>
    );
  }

  if (!partnerQueriesEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('partner.pages.commission.partnerOnly')}
      </p>
    );
  }

  if (isPending) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t('partner.commission.historyLoading')}</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <QueryErrorAlert
        error={error ?? new Error(t('partner.commission.historyLoadFailed'))}
        onRetry={
          isError
            ? () => {
                void refetch();
              }
            : undefined
        }
      />
    );
  }

  const monthTotal = data.currentMonthTotal;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('partner.commission.historyTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('partner.commission.historyDescription')}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Card className="flex-1 border-sky-200 bg-sky-50/50 dark:bg-sky-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('partner.commission.monthTotal', { month: monthLabel })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTry(monthTotal)}
            </p>
          </CardContent>
        </Card>
        <Button
          type="button"
          variant="outline"
          disabled={items.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 size-4" />
          {t('partner.commission.exportCsvPage')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 sm:px-6">
          {items.length === 0 ? (
            <EmptyState
              icon={History}
              title={t('partner.commission.emptyHistoryTitle')}
              description={t('partner.commission.emptyHistoryDescription')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('partner.commission.table.date')}</TableHead>
                  <TableHead>{t('partner.commission.table.client')}</TableHead>
                  <TableHead>{t('partner.commission.table.amount')}</TableHead>
                  <TableHead>{t('partner.commission.table.type')}</TableHead>
                  <TableHead>{t('partner.commission.table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(row.createdAt), 'd MMM yyyy HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>{row.clientOrg?.name ?? t('admin.common.emDash')}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatLedgerAmount(row.amount)}
                    </TableCell>
                    <TableCell>{commissionTypeLabel(row.type, t)}</TableCell>
                    <TableCell>{ledgerStatusBadge(row.status, t)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.total > limit ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {t('partner.commission.pagination', {
              total: data.total,
              page: data.page,
              totalPages,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('admin.common.previous')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('admin.common.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
