import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Coins, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/hooks/useAuth';
import { commissionPeriodLabel } from '@/lib/commission-month-label';
import type { PlanTier } from '@/types/subscription';

import {
  useCommissionReport,
  useCommissionSummary,
  usePartnerQueriesEnabled,
} from './hooks/usePartner';
import { PartnerPayoutRequestDialog } from './PartnerPayoutRequestDialog';
import { formatCommissionPct } from './partner-commission-labels';
import { formatTry, planLabel } from './partner-utils';

export function PartnerCommissionReportTab(): ReactElement {
  const { t } = useTranslation();
  const { isPending: authPending } = useAuth();
  const partnerQueriesEnabled = usePartnerQueriesEnabled();
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

  const periodLabel = commissionPeriodLabel(year, month, t);
  const pendingAmount = summary.data?.pendingAmount ?? 0;
  const canRequestPayout = pendingAmount >= 1;

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

  if (report.isLoading || summary.isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-live="polite">
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="rounded-md border p-4">
          <TableSkeleton rows={5} cols={5} />
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

  const data = report.data;
  if (!data) {
    return (
      <EmptyState
        icon={Coins}
        title={t('partner.commission.reportNoDataTitle')}
        description={t('partner.commission.reportNoDataDescription')}
      />
    );
  }

  const rows = data.rows ?? [];
  const trendLast6Months = data.trendLast6Months ?? [];
  const chartData = trendLast6Months.map((m) => ({
    name: m.label,
    tutar: m.total,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {t('partner.commission.cards.periodCommissionShort', { period: periodLabel })}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-primary">
            {formatTry(data.monthTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t('partner.commission.cards.previousMonth')}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatTry(data.previousMonthTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t('partner.commission.cards.lifetime')}</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatTry(data.lifetimePending)} / {formatTry(data.lifetimeSettled)}
          </p>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="mb-1 text-sm font-medium">{t('partner.commission.trendTitle')}</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('partner.commission.trendDescription')}
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number' ? formatTry(value) : String(value ?? ''),
                  t('partner.commission.table.commissionTry'),
                ]}
                labelFormatter={(l) => String(l)}
              />
              <Bar
                dataKey="tutar"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                name={t('partner.commission.table.commissionTry')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium">
            {t('partner.commission.breakdownTitle', { period: periodLabel })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {rows.length === 0
              ? t('partner.commission.breakdownNoRecords')
              : t('partner.commission.breakdownCount', { count: rows.length })}
          </p>
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
            {rows.length === 0 ? (
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
              rows.map((r) => (
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
        {rows.length > 0 ? (
          <p className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
            {t('partner.commission.periodTotal', { amount: formatTry(data.monthTotal) })}
          </p>
        ) : null}
      </div>

      <PartnerPayoutRequestDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        pendingAmount={pendingAmount}
        amountInputId="report-payout-amount"
      />
    </div>
  );
}
