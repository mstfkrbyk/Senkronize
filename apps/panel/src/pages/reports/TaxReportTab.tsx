import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { FileText, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { getApiErrorMessage } from '@/lib/api';
import { formatInvoiceAmount } from '@/pages/invoices/invoice-utils';
import { useAuthStore } from '@/store/auth.store';

import { useAccountingVatSummary } from './hooks/useAccountingVatSummary';
import {
  resolveReportsProductAccess,
  resolveTaxReportPresentation,
} from './reports-tabs.config';

const MONTHS = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

const YEARS = [2026, 2025, 2024];

function monthPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function TaxReportTab(): ReactElement {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const productAccess = useMemo(
    () => resolveReportsProductAccess(orgProducts),
    [orgProducts],
  );
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const taxPresentation = useMemo(
    () => resolveTaxReportPresentation(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const showFullTax = taxPresentation === 'full';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const periodKey = monthPeriodKey(year, month);
  const vatQuery = useAccountingVatSummary({
    month: periodKey,
    enabled: showFullTax,
  });
  const currency = vatQuery.data?.currency ?? 'TRY';

  if (accountingModeLoading && productAccess.hasAccounting) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    );
  }

  if (!showFullTax) {
    return (
      <div id="report-tax" className="space-y-6">
        <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
          <Info className="h-4 w-4 text-sky-600" aria-hidden />
          <AlertTitle className="text-sky-950">
            {t('reports.tax.externalErpTitle')}
          </AlertTitle>
          <AlertDescription className="text-sky-900/90">
            <p>{t('reports.tax.externalErpDescription')}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/reports?tab=erp-transfer"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.tax.openErpTransfer')}
              </Link>
              <Link
                to="/connections?tab=erp"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.tax.openConnections')}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id="report-tax" className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('reports.tax.year')}</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('reports.tax.month')}</span>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/invoices">
              <FileText className="mr-2 h-4 w-4" />
              {t('accounting.viewAllInvoices')}
            </Link>
          </Button>
        </div>
      </div>

      {vatQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : vatQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{getApiErrorMessage(vatQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void vatQuery.refetch()}
            >
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : vatQuery.data?.invoiceCount === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('reports.tax.emptyTitle')}
          description={t('reports.tax.emptyDesc')}
          secondaryAction={{ label: t('accounting.viewAllInvoices'), href: '/invoices' }}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('reports.tax.accountingNote')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.invoiceCount')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {vatQuery.data?.invoiceCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('accounting.vatSubtotal')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatInvoiceAmount(vatQuery.data?.subtotal ?? '0', currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('accounting.vatTax')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatInvoiceAmount(vatQuery.data?.taxAmount ?? '0', currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.totalWithVat')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatInvoiceAmount(vatQuery.data?.totalAmount ?? '0', currency)}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
