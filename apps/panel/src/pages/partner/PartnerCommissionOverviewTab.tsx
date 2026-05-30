import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Percent, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { commissionPeriodLabel } from '@/lib/commission-month-label';
import type { PlanTier } from '@/types/subscription';

import {
  useCommissionReport,
  useCommissionSummary,
} from './hooks/usePartner';
import { PartnerPayoutRequestDialog } from './PartnerPayoutRequestDialog';
import {
  commissionPaymentStatusLabel,
  type CommissionPaymentStatusLabel,
  formatCommissionPct,
} from './partner-commission-labels';
import { formatTry, planLabel } from './partner-utils';

interface MonthlySummaryRow {
  label: string;
  year: number;
  month: number;
  clientCount: number | null;
  subscriptionRevenue: number | null;
  commissionRateLabel: string;
  commissionAmount: number;
  status: CommissionPaymentStatusLabel;
}

export function PartnerCommissionOverviewTab(): ReactElement {
  const { t } = useTranslation();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payoutOpen, setPayoutOpen] = useState(false);

  const summary = useCommissionSummary();
  const report = useCommissionReport(year, month);
  const refetchAll = (): void => {
    void summary.refetch();
    void report.refetch();
  };

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const defaultRate = useMemo(() => {
    const rows = report.data?.rows ?? [];
    if (rows.length === 0) {
      return 10;
    }
    const pcts = [
      ...new Set(
        rows.map((r) => r.commissionPct).filter((pct) => Number.isFinite(pct)),
      ),
    ];
    return pcts.length === 1 ? pcts[0] : null;
  }, [report.data?.rows]);

  const monthlyRows = useMemo((): MonthlySummaryRow[] => {
    const trend = report.data?.trendLast6Months ?? [];
    const isCurrentMonth = (y: number, m: number) =>
      y === now.getFullYear() && m === now.getMonth() + 1;
    const currentClientCount = report.data?.rows.length ?? null;
    const currentRevenue = (report.data?.rows ?? []).reduce(
      (s, r) => s + r.monthlyFeeTRY,
      0,
    );
    const rateLabel =
      defaultRate != null ? formatCommissionPct(defaultRate) : t('partner.commission.perClientRate');
    const pending = (summary.data?.pendingAmount ?? 0) > 0;

    return trend.map((point, idx) => {
      const isLatest = idx === trend.length - 1;
      return {
        label: point.label,
        year: point.year,
        month: point.month,
        clientCount: isCurrentMonth(point.year, point.month) ? currentClientCount : null,
        subscriptionRevenue: isCurrentMonth(point.year, point.month)
          ? currentRevenue
          : null,
        commissionRateLabel: rateLabel,
        commissionAmount: point.total,
        status: (isLatest && pending ? 'pending' : 'paid') as CommissionPaymentStatusLabel,
      };
    });
  }, [report.data, summary.data?.pendingAmount, defaultRate, now, t]);

  if (report.isLoading || summary.isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-live="polite">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="rounded-md border p-4">
          <TableSkeleton rows={6} cols={6} />
        </div>
        <div className="rounded-md border p-4">
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (report.isError || summary.isError) {
    return (
      <QueryErrorAlert
        error={report.error ?? summary.error}
        onRetry={refetchAll}
      />
    );
  }

  const pendingAmount = summary.data?.pendingAmount ?? 0;
  const canRequestPayout = pendingAmount >= 1;

  const data = report.data;
  if (!data) {
    return (
      <EmptyState
        icon={Coins}
        title={t('partner.commission.noDataTitle')}
        description={t('partner.commission.noDataDescription')}
      />
    );
  }

  const periodLabel = commissionPeriodLabel(year, month, t);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('partner.commission.cards.pendingBalance')}
            </CardTitle>
            <Wallet className="size-4 text-amber-600" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTry(summary.data?.pendingAmount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('partner.commission.cards.pendingBalanceHint')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('partner.commission.cards.settledTotal')}
            </CardTitle>
            <Coins className="size-4 text-emerald-600" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTry(summary.data?.settledAmount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('partner.commission.cards.settledTotalHint')}
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('partner.commission.cards.periodCommission', { period: periodLabel })}
            </CardTitle>
            <Percent className="size-4 text-sky-600" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatTry(data.monthTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('partner.commission.cards.periodCommissionHint', {
                count: data.rows.length,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>{t('partner.commission.periodYear')}</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('partner.commission.periodMonth')}</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {t(`partner.commission.months.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {!canRequestPayout ? (
            <p className="text-xs text-muted-foreground sm:text-right">
              {t('partner.commission.payoutMinHint', { amount: formatTry(1) })}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!canRequestPayout}
            onClick={() => setPayoutOpen(true)}
          >
            {t('partner.commission.createPayoutRequest')}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">{t('partner.commission.summary6mTitle')}</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('partner.commission.summary6mDescription')}
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partner.commission.table.period')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.clients')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.subscriptionTry')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.rate')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.commissionTry')}</TableHead>
                <TableHead>{t('partner.commission.table.paymentStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Coins}
                      title={t('partner.commission.emptyMonthlyTitle')}
                      description={t('partner.commission.emptyMonthlyDescription')}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                monthlyRows.map((row) => (
                  <TableRow key={`${row.year}-${row.month}`}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">
                      {row.clientCount ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.subscriptionRevenue != null
                        ? formatTry(row.subscriptionRevenue)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.commissionRateLabel}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatTry(row.commissionAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'pending' ? 'secondary' : 'default'
                        }
                        className={
                          row.status === 'paid'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                            : undefined
                        }
                      >
                        {commissionPaymentStatusLabel(row.status, t)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">
          {t('partner.commission.breakdownTitle', { period: periodLabel })}
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {data.rows.length === 0
            ? t('partner.commission.breakdownEmpty')
            : t('partner.commission.breakdownCount', { count: data.rows.length })}
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partner.commission.table.client')}</TableHead>
                <TableHead>{t('partner.commission.table.plan')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.subscriptionTry')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.rate')}</TableHead>
                <TableHead className="text-right">{t('partner.commission.table.commissionTry')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Wallet}
                      title={t('partner.commission.emptyPeriodTitle', { period: periodLabel })}
                      description={t('partner.commission.emptyPeriodDescription')}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((r) => (
                  <TableRow key={r.clientOrgId}>
                    <TableCell className="font-medium">{r.clientName}</TableCell>
                    <TableCell>{planLabel(r.plan as PlanTier)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTry(r.monthlyFeeTRY)}
                    </TableCell>
                    <TableCell className="text-right">{formatCommissionPct(r.commissionPct)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatTry(r.commissionAmountTRY)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {data.rows.length > 0 ? (
          <p className="mt-2 text-right text-sm font-semibold tabular-nums">
            {t('partner.commission.periodTotal', { amount: formatTry(data.monthTotal) })}
          </p>
        ) : null}
      </div>

      <PartnerPayoutRequestDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        pendingAmount={pendingAmount}
        amountInputId="overview-payout-amount"
      />
    </div>
  );
}
