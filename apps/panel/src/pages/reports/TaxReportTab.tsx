import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFileDownload } from '@/hooks/useFileDownload';
import { getApiErrorMessage } from '@/lib/api';
import { exportToCsv } from '@/lib/csv-export';

import { useBaBsReport, useVatDeclaration } from './hooks/useTaxReports';
import { formatTry, platformDisplayName } from './report-utils';

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
const VAT_COLORS = ['#22c55e', '#0ea5e9', '#94a3b8'];

function monthPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function vatRateAmount(
  rates: { vatRatePercent: number; vatAmount: number }[],
  target: number,
): number {
  return rates.find((r) => r.vatRatePercent === target)?.vatAmount ?? 0;
}

function quarterFromMonth(year: number, month: number): string {
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

export function TaxReportTab(): ReactElement {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { downloading, download } = useFileDownload();

  const periodKey = monthPeriodKey(year, month);
  const quarter = quarterFromMonth(year, month);

  const vatQuery = useVatDeclaration({ periodKey });
  const baBsQuery = useBaBsReport({ periodKey: quarter });

  const vatRates = useMemo(
    () => vatQuery.data?.byVatRate ?? [],
    [vatQuery.data?.byVatRate],
  );

  const vatPieData = useMemo(
    () => [
      { name: '%8 KDV', value: vatRateAmount(vatRates, 8) },
      { name: '%18 KDV', value: vatRateAmount(vatRates, 18) },
      { name: '%0 KDV', value: vatRateAmount(vatRates, 0) },
    ].filter((d) => d.value > 0),
    [vatRates],
  );

  const collectedVat = vatQuery.data?.vatAmount ?? 0;
  const payableVat = collectedVat;

  function handleVatCsvExport(): void {
    const rows = (vatQuery.data?.invoiceDetails ?? []).map((inv) => ({
      siparis_no: inv.platformOrderId,
      fatura_no: inv.invoiceNumber ?? '',
      platform: inv.platform,
      tutar: inv.grossAmount,
      kdv: inv.vatAmount,
    }));
    exportToCsv(rows, `kdv-beyanname-${periodKey}`);
  }

  return (
    <div className="space-y-6">
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading === 'tax-pdf'}
            onClick={() =>
              void download({
                key: 'tax-pdf',
                url: '/reports/tax-report/pdf',
                params: { period: periodKey },
                filename: `kdv-raporu-${periodKey}.pdf`,
                mimeType: 'application/pdf',
              })
            }
          >
            {downloading === 'tax-pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {t('reports.tax.downloadVatPdf')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading === 'babs-pdf'}
            onClick={() =>
              void download({
                key: 'babs-pdf',
                url: '/reports/ba-bs/pdf',
                params: { period: quarter },
                filename: `ba-bs-${quarter}.pdf`,
                mimeType: 'application/pdf',
              })
            }
          >
            {downloading === 'babs-pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t('reports.tax.downloadBaBsPdf')}
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
          <AlertDescription>{getApiErrorMessage(vatQuery.error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.grossSales')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatTry(vatQuery.data?.grossSales ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.collectedVat')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatTry(collectedVat)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.payableVat')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{formatTry(payableVat)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('reports.tax.vatBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-24">
                {vatPieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('reports.noChartData')}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vatPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={42}
                      >
                        {vatPieData.map((_, i) => (
                          <Cell key={i} fill={VAT_COLORS[i % VAT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatTry(Number(v ?? 0))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('reports.tax.rateBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[8, 18, 0].map((rate) => (
                    <div key={rate} className="flex items-center justify-between text-sm">
                      <span>%{rate} KDV</span>
                      <span className="font-medium tabular-nums">
                        {formatTry(vatRateAmount(vatRates, rate))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t('reports.tax.platformVat')}</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={handleVatCsvExport}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.columns.platform')}</TableHead>
                      <TableHead className="text-right">{t('reports.columns.orders')}</TableHead>
                      <TableHead className="text-right">{t('reports.tax.grossSales')}</TableHead>
                      <TableHead className="text-right">KDV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vatQuery.data?.byPlatform ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          {t('reports.noTableData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (vatQuery.data?.byPlatform ?? []).map((row) => (
                        <TableRow key={row.platform}>
                          <TableCell>{platformDisplayName(row.platform)}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(row.grossSales)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatTry(row.vatAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {baBsQuery.data ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('reports.tax.baBsPreview')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('reports.tax.quarter')}: {quarter}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {baBsQuery.data.reportingNote ?? t('reports.tax.baBsHint')}
              </CardContent>
            </Card>
          ) : null}

          {vatQuery.data?.reportingNote ? (
            <p className="text-sm text-muted-foreground">{vatQuery.data.reportingNote}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
